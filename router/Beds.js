const express = require('express');
const router = express.Router();
const Bed = require('../model/Beda');
const Patient = require('../model/Patient');
const Discharged=require('../model/discharge');
 const Transfer=require('../model/transfer');
 const moment=require('moment');
 const Waiting=require('../model/WaitingList');

const cors = require('cors');

// Enable CORS for this route
router.use(
  cors({
    credentials: true,
    origin: 'http://localhost:3000',
  })
);
//bed get:
router.get('/bedGet', async (req, res) => {
  try {
    const availableBeds = await Bed.find();
    res.json(availableBeds);
  } catch (error) {
    console.error('Error fetching available beds:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
//creating ward and bed
router.post('/adbeds1', async (req, res) => {
    try {
      const { wardName, wardId, wardType, Bednumber } = req.body;
  
      // Find the existing ward by its wardId and wardType
      let existingWard = await Bed.findOne({
        'wards.wardName': wardName,
        'wards.wardId': wardId,
        'wards.wardType': wardType,
      });
  
      // If the ward doesn't exist, create a new one
      if (!existingWard) {
        existingWard = new Bed({
          wards: [
            {
              wardName,
              wardId,
              wardType,
              beds: [],
            },
          ],
        });
      }
  
      // Get the current bed count in the ward
      const currentBeds = existingWard.wards[0].beds || [];
  
      if (Bednumber >= 0) {
        // Get the starting bed number
        const startingBedNumber =
          currentBeds.length > 0
            ? parseInt(currentBeds[currentBeds.length - 1].bedNumber.split('_')[1]) + 1
            : 1;
  
        // Add the specified number of beds to the existing or new ward
        for (let i = 1; i <= Bednumber; i++) {
          const newBedNumber = startingBedNumber + i - 1;
          const newBed = {
            bedNumber: `bed_${newBedNumber}`,
            status: 'available',
          };
          currentBeds.push(newBed);
        }
  
        // Update the beds array in the existing or newly created ward
        existingWard.wards[0].beds = currentBeds;
  
        // Save the updated or newly created ward
        await existingWard.save();
  
        res.status(200).json({ message: `Added ${Bednumber} beds to the specified ward successfully` });
      } else {
        return res.status(400).json({ error: 'Invalid bed count' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to add beds to the ward' });
    }
  });
  


// get admit:


router.get('/aff', async (req, res) => {
  try {
    const pat1 = await Patient.find();
    res.json(pat1);
  } catch (error) {
    res.json(error);
  }
});

const generateRandomString = (length) => {
  const characters = 'ABCDEF1234';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// Function to generate a unique patient ID using only a short random string
const generatePatientID = () => `PAT-${generateRandomString(4)}`; // Adjust the length as needed

// Function to calculate the risk score based on medical acuity
function calculateRiskScore(medicalAcuity) {
  switch (medicalAcuity) {
    case "Critical":
      return 0.85;
    case "Moderate":
      return 0.65;
    case "Stable":
      return 0.45;
    default:
      return 0.1; // Default risk score for unknown or unassigned medical acuity
  }
}

async function calculateInfectionRate() {
  try {
    const totalAdmittedPatients = await Patient.countDocuments({});
    const infectedPatients = await Patient.countDocuments({ infectionStatus: 'infected' });
    
    if (totalAdmittedPatients === 0) {
      //return 0;
      return "0%";

    }

    //return (infectedPatients / totalAdmittedPatients) * 100;
    const rate = (infectedPatients / totalAdmittedPatients) * 100;

    return rate.toFixed(2) + "%"; // Limiting to two decimal places and adding '%' sign

  } catch (error) {
    console.error('Failed to calculate infection rate', error);
    throw error;
  }
}

// POST endpoint to admit a patient with risk score calculation
router.post('/admitpt', async (req, res) => {
  try {
    const {
      patientName, age, gender, contactno, wardId, wardName, bedNumber, medicalAcuity,
      admittingDoctors, admissionDate, admissionTime, assignedNurse, tasks,
      address, abhaNo, infectionStatus
    } = req.body;

    // Automatically generate a unique patient ID
    const patientId = generatePatientID();

    // Ensure admissionDate is today or in the future
    const now = new Date();
    const selectedDate = new Date(admissionDate);

    // Compare only the date part
    now.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < now) {
      return res.status(400).json({ error: 'Admission date must be today or a future date.' });
    }

    // Calculate risk score based on medical acuity
    const riskScore = calculateRiskScore(medicalAcuity);

    // Create a new Patient document with riskScore and infectionStatus
    const newPatient = new Patient({
      patientName, age, gender, contactno, wardId, patientId, wardName, bedNumber,
      medicalAcuity, admittingDoctors, admissionDate, admissionTime,
      assignedNurse, abhaNo, address, tasks, riskScore, infectionStatus
    });

    // Check if the specified ward and bed exist
    const bed = await Bed.findOne({
      'wards.wardId': wardId,
      'wards.beds.bedNumber': bedNumber
    });

    if (!bed) {
      return res.status(400).json({ error: 'Ward or bed does not exist.' });
    }

    // Check if the bed is available
    const selectedBed = bed.wards.find(wardItem => wardItem.wardId === wardId).beds.find(bedItem => bedItem.bedNumber === bedNumber);
    if (selectedBed.status === 'occupied') {
      return res.status(400).json({ error: 'Selected bed is already occupied.' });
    }

    // Save the patient
    const savedPatient = await newPatient.save();

    // Mark the bed as occupied in the bed collection
    selectedBed.status = 'occupied';
    selectedBed.patientId = patientId;
    selectedBed.patientName = patientName;
    selectedBed.age = age;
    selectedBed.gender = gender;
    selectedBed.contactno = contactno;
    selectedBed.medicalAcuity = medicalAcuity;

    // Save changes to the bed data
    await bed.save();

    // Calculate infection rate
    const infectionRate = await calculateInfectionRate();

    res.status(201).json({ patient: savedPatient, infectionRate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET endpoint to calculate infection rate
router.get('/infectionrate', async (req, res) => {
  try {
    const infectionRate = await calculateInfectionRate();
    res.json({ infectionRate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

////transfer+ID:

// Function to generate a random alphanumeric string of a given length
const generateRandomStrings = (length) => {
  const characters = 'TRA1234';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// Function to generate a unique patient ID using only a short random string
const generatetranID = () => `TAT-${generateRandomStrings(4)}`; // Adjust the length as needed


router.post('/tpsss', async (req, res) => {
  const {
    currentWardId,
    currentBedNumber,
    patientName,
    age,
    gender,
    contactno,
    patientId,
    transferWardId,
    transferBedNumber,
    medicalAcuity,
    transferReasons,
    extraTransferReason,
  } = req.body;

    // Automatically generate a unique patient ID
    const transferId = generatetranID();
  try {
    // Find the current bed within the current ward
    const currentBed = await Bed.findOne({
      'wards.wardId': currentWardId,
      'wards.beds.bedNumber': currentBedNumber,
    });

    if (!currentBed) {
      return res.status(400).json({ error: 'Current bed does not exist in the selected ward.' });
    }

    // Check if the current bed is occupied
    const currentBedIndex = currentBed.wards[0].beds.findIndex(
      (bed) => bed.bedNumber === currentBedNumber && bed.status === 'occupied'
    );

    if (currentBedIndex === -1) {
      return res.json({ message: 'Current bed is already available.' });
    }

    // Find the transfer bed within the transfer ward
    const transferBed = await Bed.findOne({
      'wards.wardId': transferWardId,
      'wards.beds.bedNumber': transferBedNumber,
      'wards.beds.status': 'available',
    });

    if (!transferBed) {
      return res.status(400).json({ error: 'Transfer bed not found or not available.' });
    }

    // Update the current bed to available
    currentBed.wards[0].beds[currentBedIndex].status = 'available';
    currentBed.wards[0].beds[currentBedIndex].patientId = '';
    currentBed.wards[0].beds[currentBedIndex].patientName = '';
    currentBed.wards[0].beds[currentBedIndex].age= '';
    currentBed.wards[0].beds[currentBedIndex].medicalAcuity = '';
    currentBed.wards[0].beds[currentBedIndex].gender = '';
    currentBed.wards[0].beds[currentBedIndex].contactno= '';



    // Find the index of the transfer bed within the transfer ward
    const transferBedIndex = transferBed.wards[0].beds.findIndex(
      (bed) => bed.bedNumber === transferBedNumber && bed.status === 'available'
    );

    if (transferBedIndex === -1) {
      return res.status(400).json({ error: 'Transfer bed is not available.' });
    }

    // Update the transfer bed to occupied with patient information
    transferBed.wards[0].beds[transferBedIndex].status = 'occupied';
    transferBed.wards[0].beds[transferBedIndex].patientId = patientId;
     transferBed.wards[0].beds[transferBedIndex].patientName = patientName;
     transferBed.wards[0].beds[transferBedIndex].age= age;
    transferBed.wards[0].beds[transferBedIndex].gender = gender;
     transferBed.wards[0].beds[transferBedIndex].contactno = contactno;
     transferBed.wards[0].beds[transferBedIndex].medicalAcuity = medicalAcuity;




    // Save changes to the database
    await currentBed.save();
    await transferBed.save();

    // Save transfer information to Transfer collection
    const transfer = new Transfer({
      patientName,
      age,
      gender,
      patientId,
      transferId,
      contactno,
      currentWardId: currentBed.wards[0]._id,
      currentBedNumber,
      transferWardId: transferBed.wards[0]._id,
      transferBedNumber,
      medicalAcuity,
      transferReasons,
      extraTransferReason,
    });

    await transfer.save();

    res.json({ message: 'Patient transfer successful. Transfer bed marked as occupied.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error performing bed action.' });
  }
});

//transferGet:
router.get('/transferGet', async (req, res) => {
  try {
    const TransferBeds = await Transfer.find();
    res.json(TransferBeds);
  } catch (error) {
    res.json(error);
  }
});

//discharge of patient:1:{latest}:

// Function to generate a random alphanumeric string of a given length
const generatedischargeString = (length) => {
  const characters = '2412';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// Function to generate a unique patient ID using only a short random string
const generatedischargeId = () => `Dsh-${generatedischargeString(4)}`; // Adjust the length as needed


//Discharge
router.post('/distaa', async (req, res) => {
    try {
      const {
        patientId,
        patientName,
        medicalAcuity,
        age,
        gender,
        admissionDate,
        wardId,
        bedNumber,
        dischargeReasons,
        dischargeDate,
        dischargeTime
      } = req.body;
  
        // Automatically generate a unique patient ID
      const dischargeId = generatedischargeId();
    
  
      // Find the bed within the ward
      const bedData = await Bed.findOne({ 'wards.wardId': wardId });
  
      if (!bedData) {
        return res.status(404).json({ error: 'Ward not found.' });
      }
  
      // Find the specific bed within the ward
      const selectedBed = bedData.wards
        .find((w) => w.wardId === wardId)
        .beds.find((b) => b.bedNumber === bedNumber);
  
      // Logging for debugging
      console.log('Bed Data:', bedData);
      console.log('Selected Bed:', selectedBed);
  
      // Check if patient is occupying the bed and is not already discharged
      if (selectedBed && selectedBed.status === 'occupied' && selectedBed.patientId === patientId) {
        // Check if patient is already discharged
        const isAlreadyDischarged = await Discharged.exists({ patientId });
  
        if (isAlreadyDischarged) {
          return res.status(400).json({ error: 'Patient is already discharged.' });
        }
  
        // Update bed record
        selectedBed.status = 'available';
        selectedBed.patientId = '';
        selectedBed.patientName = '';
        selectedBed.age='';
        selectedBed.contactno='';
        selectedBed.gender='';
        selectedBed.medicalAcuity='';

  
        // Save the updated bed record
        await bedData.save();
  
        // Calculate mortality rate (example calculation, adjust as needed)
        const totalBedsInWard = bedData.wards.reduce((total, ward) => total + ward.beds.length, 0);
        const dischargedRecords = await Discharged.find({ 'dischargeReasons': 'died' });
        const totalDiedCases = dischargedRecords.length;
        const mortalityRate = (totalDiedCases / totalBedsInWard) * 100;

        // Delete patient record from the patients collection
        await Patient.deleteOne({ patientId });
  
        // Log the calculated mortality rate
        console.log('Calculated Mortality Rate:', mortalityRate);
  
        // Create a discharged record with all the data fields
        const discharged = new Discharged({
          dischargeId,
          patientName,age,
          gender,
          medicalAcuity,
          admissionDate,
          wardId,
          bedNumber,
          dischargeReasons,
          dischargeDate,
          dischargeTime,
          mortalityRate,
        });
  
        // Save the discharged record
        await discharged.save();
  
        res.json({ message: 'Patient discharged and bed record updated successfully.', mortalityRate });
      } else {
        res.status(400).json({ error: 'Patient discharged.' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error discharging patient and updating bed record.' });
    }
  });

////get discharge method:
router.get('/Disget',async(req,res)=>{
  try{
    const h1 = await Discharged.find()
    res.json(h1)
    console.log(h1);
  }
  catch(error){
      res.json(error)
  }
})


//Dashboard1:
  router.get('/bed1d', async (req, res) => {
    try {
      // Fetch all wards from the database
      const wards = await Bed.find({}, { wards: 1 });
  
      // Check if no wards are found
      if (!wards || wards.length === 0) {
        return res.status(404).json({ message: 'No ward data found.' });
      }
  
      const thisWeekStart = moment().startOf('isoWeek');
      const thisMonthStart = moment().startOf('month');
  
      const bedStatusPerWard = {};
  
      // Iterate over each ward
      wards.forEach(wardData => {
        wardData.wards.forEach(ward => {
          const wardName = ward.wardName;
  
          let occupiedBedsThisWeek = 0;
          let occupiedBedsThisMonth = 0;
  
          ward.beds.forEach(bed => {
            if (bed.status === 'occupied') {
              const occupiedDate = moment(bed.occupiedTimestamp);
              if (occupiedDate.isSameOrAfter(thisWeekStart, 'day')) {
                occupiedBedsThisWeek++;
              }
              if (occupiedDate.isSameOrAfter(thisMonthStart, 'day')) {
                occupiedBedsThisMonth++;
              }
            }
          });
  
          const availableBeds = ward.beds.filter(bed => bed.status === 'available').length;
  
          bedStatusPerWard[wardName] = {
            occupiedThisWeekBeds: occupiedBedsThisWeek,
            occupiedThisMonthBeds: occupiedBedsThisMonth,
            availableBeds: availableBeds,
          };
        });
      });
  
      const admissionStatistics = {
        thisWeek: Object.values(bedStatusPerWard).reduce((total, ward) => total + ward.occupiedThisWeekBeds, 0),
        thisMonth: Object.values(bedStatusPerWard).reduce((total, ward) => total + ward.occupiedThisMonthBeds, 0),
      };
  
      // Send the response
      res.json({
        bedStatusPerWard,
        admissionStatistics,
      });
    } catch (error) {
      // Handle any errors that occur during execution
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });





//dashboardnew1:
// Route to check available time for beds in a specific ward
router.get('/bedAvailabilityBoard', async (req, res) => {
    
  try {
    // Fetch bed availability data from the database
    const bedAvailabilityData = await Bed.find();

    // Format the data for the heatmap representation
    const formattedData = formatBedAvailabilityData(bedAvailabilityData);

    res.status(200).json(formattedData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve bed availability data' });
  }
});

// Helper function to format bed availability data for the heatmap
function formatBedAvailabilityData(bedAvailabilityData) {
  const formattedData = {
    bedAvailability: [],
  };

  // Iterate through each ward and time slot in the data
  bedAvailabilityData.forEach((ward) => {
    ward.wards.forEach((timeSlot) => {
      // Create a new entry in the formatted data
      const entry = {
        ward: timeSlot.wardName,
        time: getRandomTime(), // Use a random time for each time slot
        availableBeds: 0, // Default to 0 if no beds are available
      };

      // Calculate the total available beds for the time slot
      timeSlot.beds.forEach((bed) => {
        if (bed.status === 'available') {
          entry.availableBeds += 1;
        }
      });

      // Adjust admission time if a person gets admitted
      if (entry.availableBeds > 0) {
        entry.time = adjustAdmissionTime(entry.time);
      }

      // Add the entry to the formatted data
      formattedData.bedAvailability.push(entry);
    });
  });

  return formattedData;
}

// Helper function to get a random time within the specified range (8 am to 11 pm)
function getRandomTime() {
  const randomHour = Math.floor(Math.random() * (15 - 8 + 1)) + 8; // Random hour between 8 and 11
  const randomMinute = Math.floor(Math.random() * 60);
  return moment().hour(randomHour).minute(randomMinute).format('HH:mm A');
}

// Helper function to adjust admission time within the specified range (8 am to 11 pm)
function adjustAdmissionTime(currentTime) {
  // Reduce the admission time by a random number of minutes
  const randomMinutes = Math.floor(Math.random() * 60);
  const adjustedTime = moment(currentTime, 'HH:mm A').subtract(randomMinutes, 'minutes');

  // Ensure the adjusted time is within the specified range (8 am to 11 pm)
  if (adjustedTime.isBefore(moment('08:00 AM', 'hh:mm A'))) {
    return moment('08:00 AM', 'hh:mm A').format('HH:mm A');
  } else if (adjustedTime.isAfter(moment('11:00 PM', 'hh:mm A'))) {
    return moment('11:00 PM', 'hh:mm A').format('HH:mm A');
  }

  return adjustedTime.format('HH:mm A');
}

// DASHBOARD 4
router.get('/paaG', async (req, res) => {

  try {
    // Use aggregate to get unique combinations of wardName and medicalAcuity with count
    const uniqueCombinationsWithCount = await Patient.aggregate([
      {
        $group: {
          _id: { wardName: '$wardName', medicalAcuity: '$medicalAcuity' },
          count: { $sum: 1 },
        },
      },
    ]);
  
    // Organize data in the desired format
    const result = {};
    uniqueCombinationsWithCount.forEach((entry) => {
      const wardName = entry._id.wardName;
      const medicalAcuity = entry._id.medicalAcuity;
      const count = entry.count;
  
      // Check if wardName exists in result, if not, initialize it
      if (!result[wardName]) {
        result[wardName] = {};
      }
  
      // Store count for each medicalAcuity under the specific ward
      result[wardName][medicalAcuity] = count;
    });
  
    // Send the result as JSON response
    res.json({ patientAcuityBreakdown: result });
  } catch (error) {
    // Handle errors
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
  });
  
//dash:11:
router.get('/patient', async (req, res) => {
  try {
    // Calculate readmission rate
    const readmissionRateData = await Patient.aggregate([
      {
        $group: {
          _id: '$contactno',
          totalAdmissions: { $sum: 1 },
          totalReadmissions: { $sum: { $cond: [{ $ne: ['$admissionDate', '$dischargeDate'] }, 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          readmissionRate: { $cond: [{ $eq: ['$totalAdmissions', 0] }, 0, { $divide: ['$totalReadmissions', '$totalAdmissions'] }] }
        }
      }
    ]);

    // Calculate the total readmission rate
    const totalReadmissionRate = readmissionRateData.reduce((total, record) => {
      return total + record.readmissionRate;
    }, 0);

    // Calculate infection rate
    const totalAdmittedPatients = await Patient.countDocuments();
    const infectedPatients = await Patient.countDocuments({ infectionStatus: 'infected' });
    const infectionRate = (totalAdmittedPatients === 0) ? 0 : (infectedPatients / totalAdmittedPatients) * 100;

    // Calculate avgLengthOfStay
    const patients = await Patient.find();
    const avgLengthOfStay = patients.reduce((total, patient) => {
      if (patient.admissionDate && patient.dischargeDate) {
        const admissionDate = new Date(patient.admissionDate);
        const dischargeDate = new Date(patient.dischargeDate);
        const lengthOfStay = (dischargeDate - admissionDate) / (1000 * 60 * 60 * 24); // Convert milliseconds to days
        return total + lengthOfStay;
      }
      return total;
    }, 0) / patients.length;

    // Get the date from the first patient in the collection
    const firstPatient = patients[0];
    const date = firstPatient ? firstPatient.admissionDate : null;

    // Create the desired output object
    const output = {
      patientOutcomeMetrics: [
        {
          date: date,
          mortalityRate: 0.03, // Example value, you can calculate this based on your data
          readmissionRate: totalReadmissionRate,
          avgLengthOfStay: avgLengthOfStay
        }
      ]
    };

    res.json(output);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

  //dashboard 7:
  
  
// GET endpoint to retrieve patient data including patientName, medicalAcuity, and riskScore
router.get('/patientriskget', async (req, res) => {
  try {
      // Find all patients in the database
      const patients = await Patient.find();

      // Extract patient data including patientName, medicalAcuity, and riskScore
      const patientData = patients.map((patient) => {
          // Extract medicalAcuity from the array if it's an array, otherwise use it directly
          const acuity = Array.isArray(patient.medicalAcuity) ? patient.medicalAcuity[0] : patient.medicalAcuity;
          // Calculate riskScore based on medicalAcuity
          const riskScore = calculateRiskScore(acuity);

          return {
              patientName: patient.patientName,
              medicalAcuity: acuity,
              riskScore: riskScore,
          };
      });

      // Send back the patient data
      res.status(200).json(patientData);
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

  
  
  //Dashboard 12:
  
  router.get('/pace', async (req, res) => {
    try {
      const patients = await Patient.find(); // Retrieve all patients
  
      const patientCounts = {};
  
      patients.forEach((patient) => {
        // Check if the patient has wards and admissionTime
        if (patient.wardName && patient.admissionTime) {
          const key = `${patient.wardName}-${patient.admissionTime}`;
          patientCounts[key] = (patientCounts[key] || 0) + 1;
        }
      });
  
      // Transform the patientCounts object into an array of objects
      const formattedCounts = Object.keys(patientCounts).map((key) => ({
        wardName: key.split('-')[0],
        admissionTime: key.split('-')[1],
        patientCount: patientCounts[key],
      }));
  
      res.status(200).json({ patientCounts: formattedCounts });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  //Dasboard 6:
  router.get('/patientCareDashboard', async (req, res) => {
    try {
      const patientsData = await Patient.find();
      const formattedData = patientsData.map(patient => ({
        name: patient.patientName,
        medicalAcuity: patient.medicalAcuity,
        assignedNurse: patient.assignedNurse,
        tasks: patient.tasks,
      }));
  
      res.status(200).json({ patients: formattedData });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to retrieve patient care dashboard data' });
    }
  });
  
//Dashboard 3:
  router.get('/availablebeddds', async (req, res) => {
    try {
      const availableWards = await Bed.find({ 'wards.beds.status': 'available' });
  
      if (!availableWards || availableWards.length === 0) {
        return res.status(404).json({ message: 'No available beds found.' });
      }
  
      const realTimeBedAvailability = [];
  
      availableWards.forEach((wardDocument) => {
        wardDocument.wards.forEach((ward) => {
          const wardName = ward.wardName; // Access wardName directly
          const availableCount = ward.beds.filter((bed) => bed.status === 'available').length;
  
          realTimeBedAvailability.push({ ward: wardName, availableBeds: availableCount });
        });
      });
  
      res.json({ realTimeBedAvailability });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
//dashboard 2
  router.get('/wardoccupancys', async (req, res) => {
    try {
      const occupiedWards = await Bed.find({ 'wards.beds.status': 'occupied' });
  
      if (!occupiedWards || occupiedWards.length === 0) {
        return res.status(404).json({ message: 'No occupied beds found.' });
      }
  
      const wardOccupancy = [];
  
      for (const wardDocument of occupiedWards) {
        for (const ward of wardDocument.wards) {
          const wardName = ward.wardName;
          const occupiedCount = ward.beds.filter((bed) => bed.status === 'occupied').length;
  
          wardOccupancy.push({ ward: wardName, occupancy: occupiedCount });
        }
      }
  
      res.json({ wardOccupancy });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  //Dashboard 8

//8.turnaroundTime:

router.get('/bedturnaroundtime', async (req, res) => {
  try {
    // Initialize an array to store bed turnaround time information
    const bedTurnaroundTime = [];

    // Find all discharged patients in the database
    const dischargedPatients = await Discharged.find();

    // Iterate through each discharged patient
    for (const dischargedPatient of dischargedPatients) {
      // Destructure relevant information from the discharged patient record
      const { wardId, bedNumber, dischargeDate, dischargeTime } = dischargedPatient;

      // Find the corresponding admission record for the same bed and date
      const admissionPatient = await Patient.findOne({
        'wardId': wardId,
        'bedNumber': bedNumber,
        'admissionDate': dischargeDate,
        'admissionTime': { $gt: dischargeTime },
      }).sort({ admissionTime: 1 });

      // Check if there is a corresponding admission record
      if (admissionPatient) {
        // Calculate turnaround time in minutes between discharge and admission
        const dischargeDateTime = moment(`${dischargeDate} ${dischargeTime}`, 'YYYY-MM-DD hh:mm A');
        const admissionDateTime = moment(`${admissionPatient.admissionDate} ${admissionPatient.admissionTime}`, 'YYYY-MM-DD hh:mm A');
        const turnaroundTime = admissionDateTime.diff(dischargeDateTime, 'minutes');

        // Format the date as "YYYY-MM-DD"
        const formattedDate = moment(dischargeDate, 'YYYY-MM-DD').format('YYYY-MM-DD');

        // Find the ward name based on wardId
        const bed = await Bed.findOne({ 'wards.wardId': wardId, 'wards.beds.bedNumber': bedNumber });
        const wardName = bed ? bed.wards.find(ward => ward.wardId == wardId).wardName : null;

        // Push the bed turnaround time information to the array
        bedTurnaroundTime.push({
          ward: wardName,
          date: formattedDate,
          turnaroundTime: turnaroundTime,
        });
      }
    }

    // Send the bed turnaround time information as JSON response
    res.json({ bedTurnaroundTime });
  } catch (error) {
    // Handle any errors that occur during the process
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//5.Dashboard 5
// Define a GET route to fetch admissions and discharges trend data
router.get('/admission-discharge', async (req, res) => {
  try {
    // Fetch all admissions and discharges records from the Patient and Discharged collections
    const admissions = await Patient.find({}, 'admissionDate');
    const discharges = await Discharged.find({}, 'dischargeDate');

    // Combine admissions and discharges data
    const allEvents = [...admissions, ...discharges];

    // Create a data structure to group admissions and discharges by date
    const trendData = {};

    allEvents.forEach((event) => {
      // Check if the date field is defined
      if (event.admissionDate || event.dischargeDate) {
        const formattedDate = formatDate(event.admissionDate || event.dischargeDate);

        if (!trendData[formattedDate]) {
          trendData[formattedDate] = { admissions: 0, discharges: 0 };
        }

        if (event.admissionDate) {
          trendData[formattedDate].admissions += 1;
        } else if (event.dischargeDate) {
          trendData[formattedDate].discharges += 1;
        }
      }
    });

    //console.log(trendData);

    // Convert the data structure into the desired output format
    const admissionsDischargesTrend = Object.entries(trendData).map(([date, data]) => ({
      date,
      admissions: data.admissions,
      discharges: data.discharges,
    }));

    res.json({ admissionsDischargesTrend });
  } catch (error) {
    console.error('Error fetching admissions and discharges trend data:', error);
    res.status(500).json({ error: 'Error fetching admissions and discharges trend data.' });
  }
});

// Helper function to format dates to "DD-MM-YYYY" format
function formatDate(dateString) {
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateString; // Return unchanged if not in the expected format
}
//Dashboard 6:
router.get('/patientCareDashboard', async (req, res) => {
  try {
    const patientsData = await Patient.find();
    const formattedData = patientsData.map(patient => ({
      name: patient.patientName,
      medicalAcuity: patient.medicalAcuity,
      assignedNurse: patient.assignedNurse,
      tasks: patient.tasks,
    }));

    res.status(200).json({ patients: formattedData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve patient care dashboard data' });
  }
});

//Dashboard 10
router.get('/patientflow', async (req, res) => {
  try {
    const patientFlow = [];

    // Find all transfer records
    const transferRecords = await Transfer.find();

    // Create a map to store patient flow counts
    const patientFlowMap = {};

    // Iterate through transfer records and count the flows from currentWardId to transferWardId
    for (const transfer of transferRecords) {
      const { currentWardId, transferWardId } = transfer;
      console.log(`currentWardId: ${currentWardId}, transferWardId: ${transferWardId}`);

      // Create a unique key for each patient flow
      const flowKey = `${currentWardId} to ${transferWardId}`;

      // Increment the count for the flow in the map
      patientFlowMap[flowKey] = (patientFlowMap[flowKey] || 0) + 1;
    }

    // Convert the map to the desired output format with ward names
    for (const key in patientFlowMap) {
      const [from, to] = key.split(' to ');
      const value = patientFlowMap[key];

      patientFlow.push({ from, to, value });
    }

    res.json({ patientFlow });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


  // router.get('/patientflow', async (req, res) => {
  //   try {
  //     const patientFlow = [];
  
  //     // Find all transfer records
  //     const transferRecords = await Transfer.find();
  
  //     // Create a map to store patient flow counts
  //     const patientFlowMap = {};
  
  //     // Iterate through transfer records and count the flows from currentdept to transferdept
  //     for (const transfer of transferRecords) {
  //       const { currentWardId, transferWardId } = transfer;
  //       console.log(`currentWardId: ${currentWardId}, transferWardId: ${transferWardId}`);
  
  //       // Create a unique key for each patient flow
  //       const flowKey = `${currentWardId} to ${transferWardId}`;

  //       console.log(flowKey); //Ex:Ward A1 to Ward B1

  
  //       // Increment the count for the flow in the map
  //       patientFlowMap[flowKey] = (patientFlowMap[flowKey] || 0) + 1;
  //     }

  //     //console.log(patientFlowMap); //Ex{'Ward A1 to Ward B1': 1}
  
  //     // Convert the map to the desired output format
  //     for (const key in patientFlowMap) {
  //       const [from, to] = key.split(' to ');
  //       const value = patientFlowMap[key];
  
  //       patientFlow.push({ from, to, value });
  //     }
  
  //     res.json({ patientFlow });
  //   } catch (error) {
  //     console.error(error);
  //     res.status(500).json({ error: 'Internal server error' });
  //   }
  // });


   

//waitinglist:
const generateRandomStringi = (length) => {
  const characters = 'ABCDEF1234';
  let result = '';
  for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const genPatientID = () => `PAT-${generateRandomStringi(4)}`;

router.post('/waitingentryy1', async (req, res) => {
  try {
    const { patientName, contactno, medicalAcuity, admittingDoctors, wardId, wardName, bedNumber, priority, age, gender, admissionDate, admissionTime, assignedNurse, tasks, address, abhaNo } = req.body;

    const patientId = genPatientID();

    const newEntry = {
      WaitlistEntryfields: [{ 
        patientName,
        patientId,
        contactno,
        medicalAcuity,
        wardId,
        bedNumber,
        wardName,
        priority,
        age,
        gender,
        admittingDoctors,
        admissionDate,
        admissionTime,
        assignedNurse,
        tasks,
        address,
        abhaNo
      }]
    };
    
    const createdEntry = await Waiting.create(newEntry);

      const newPatient = {
          patientName,
          patientId,
          contactno,
          age,
          gender,
          wardId,
          priority,
          wardName,
          bedNumber,
          admittingDoctors,
          admissionDate,
          admissionTime,
          assignedNurse,
          tasks,
          address,
          abhaNo
      };

      const createdPatient = await Patient.create(newPatient);
      res.status(201).json({ createdEntry });
  } catch (error) {
      res.status(500).json({ error: 'Failed to create entry', details: error.message });
  }
});

router.put('/pro',async(req,res)=>{
  try{
    const{patientId,priority} = req.body
    const wait = await Waiting.findOneAndUpdate({ 'WaitlistEntryfields.patientId': patientId },{$set:{'WaitlistEntryfields.$.priority': priority }});

    if (!wait) {
      return res.status(404).json({ error: 'Patient not found in the waiting list.' });
    }

    res.json({ message: 'Priority assigned successfully.'});

  }
  catch(err){
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
})


  //Get available bed
  router.get('/avabeds1d', async (req, res) => {
    try {
      const availableWards = await Bed.find({ 'wards.beds.status': 'available' });
  
      if (!availableWards || availableWards.length === 0) {
        return res.status(404).json({ message: 'No available beds found.' });
      }
  
      const realTimeBedAvailability = [];
  
      availableWards.forEach((wardDocument) => {
        wardDocument.wards.forEach((ward) => {
          const wardName = ward.wardName; // Access wardName directly
          const availableCount = ward.beds.filter((bed) => bed.status === 'available').map((bed) => ({ bedNumber: bed.bedNumber }));
  
          realTimeBedAvailability.push({ ward: wardName, availableBeds: availableCount});
        });
      });
  
      res.json({ realTimeBedAvailability });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
//landing page:
router.get('/Admit',async(req,res)=>{
  try{
   const Admit = await Patient.find({},'-_id')
   
   if(!Admit){
    res.status(404).json({message:"Patient Not Found"})
   }

    res.status(201).json(Admit)
  
  }

  catch(err){
    res.status(500).json({message:'Internal server error'})
  }
})


router.put('/updatept', async (req, res) => {
  try {
    const {
      patientName, patientId,contactno, medicalAcuity,
      admittingDoctors,
    } = req.body;

    // Find the patient by patientId
    const existingPatient = await Patient.findOne({ patientId });

    if (!existingPatient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    // Update patient information
    existingPatient.patientName = patientName;
    existingPatient.contactno = contactno;
    existingPatient.medicalAcuity = medicalAcuity;
    existingPatient.admittingDoctors = admittingDoctors;

    // Save the updated patient
    const updatedPatient = await existingPatient.save();

    res.json(updatedPatient);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.delete('/deletept/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;

    // Find the patient by patientId
    const existingPatient = await Patient.findOne({ patientId });

    if (!existingPatient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    // Find the bed associated with the patient
    const bed = await Bed.findOne({
      'wards.wardId': existingPatient.wardId,
      'wards.beds.bedNumber': existingPatient.bedNumber
    });

    if (!bed) {
      return res.status(500).json({ error: 'Internal server error - Bed not found for patient.' });
    }

    // Mark the bed as available
    const selectedWard = bed.wards.find(wardItem => wardItem.wardId === existingPatient.wardId);
    const selectedBed = selectedWard.beds.find(bedItem => bedItem.bedNumber === existingPatient.bedNumber);

    if (!selectedBed) {
      return res.status(500).json({ error: 'Internal server error - Bed not found for patient.' });
    }

    selectedBed.status = 'available';
    selectedBed.patientId = '';

    // Save changes to the bed data
    await bed.save();

    // Remove the patient from the database
    await existingPatient.deleteOne();

    res.json({ message: 'Patient deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//Dashboard 9
// Function to calculate infection rate
async function calculateInfectionRate() {
  try {
    const totalAdmittedPatients = await Patient.countDocuments();
    const infectedPatients = await Patient.countDocuments({ infectionStatus: 'infected' });
    if (totalAdmittedPatients === 0) {
      return 0;
    }
    return (infectedPatients / totalAdmittedPatients) * 100;
  } catch (error) {
    console.error('Failed to calculate infection rate', error);
    throw error;
  }
}
router.get('/:wardId/statistics', async (req, res) => {
  try {
    const { wardId } = req.params;

    // Find the bed within the ward
    const bedData = await Bed.findOne({ 'wards.wardId': wardId });

    if (!bedData) {
      return res.status(404).json({ error: 'Ward not found.' });
    }

    // Calculate infection rate
    const totalAdmittedPatients = await Patient.countDocuments();
    const infectedPatients = await Patient.countDocuments({ infectionStatus: 'infected' });
    const infectionRate = totalAdmittedPatients === 0 ? 0 : (infectedPatients / totalAdmittedPatients) * 100;

    // Calculate mortality rate
    const totalBedsInWard = bedData.wards.reduce((total, ward) => total + ward.beds.length, 0);
    const dischargedRecords = await Discharged.find({ wardId, 'dischargeReasons': 'died' });
    const totalDiedCases = dischargedRecords.length;
    const mortalityRate = (totalDiedCases / totalBedsInWard) * 100;

    res.json({ wardId, infectionRate, mortalityRate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error retrieving statistics for the ward.' });
  }
});
//Wait Get
router.get('/Waiting',async(req,res,next)=>{
  try{
   const wait = await Waiting.find({},'-_id WaitlistEntryfields.patientName WaitlistEntryfields.patientId WaitlistEntryfields.age WaitlistEntryfields.gender WaitlistEntryfields.priority WaitlistEntryfields.admittingDoctors WaitlistEntryfields.admissionDate')
   
   if(!wait){
    res.status(404).json({message:"Patient Not Found"})
   }
  
res.status(201).json(wait)
  
  }

  catch(err){
    next(err)
 }
})

router.put('/assignbedss', async (req, res) => {
  try {
    const { bedNumber, patientId } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'PatientId is required in the request body.' });
    }

    // Find the patient in the Waitinglist collection
    const waitingPatient = await Waiting.findOne({ 'WaitlistEntryfields.patientId': patientId });

    if (!waitingPatient) {
      return res.status(404).json({ error: 'Patient not found in the waiting list.' });
    }

    // Remove the patient from the waiting list

    // Update the bedNumber in the Patient collection
    await Patient.updateOne({ patientId }, { $set: { bedNumber } });

    // Update or create the corresponding record in the Bed collection
    let existingBed = await Bed.findOne({ 'wards.beds.bedNumber': bedNumber });

    if (existingBed) {
      // Update existing record
      existingBed.wards.forEach((ward) => {
        const bedToUpdate = ward.beds.find((bed) => bed.bedNumber === bedNumber);
        if (bedToUpdate) {
          bedToUpdate.status = 'occupied';
          bedToUpdate.assignedPatientId = patientId;
        }
      });

      // Save the changes to the existingBed
      await existingBed.save();
    } else {
      // Create new record
      const newBed = new Bed({
        wards: [{
          wardName: waitingPatient.WaitlistEntryfields.wardName,
          beds: [{
            bedNumber,
            status: 'occupied',
            assignedPatientId: patientId,
            
          }]
        }]
      });

      // Save the newBed
      await newBed.save();
    }

    res.json({ message: 'Bed assigned successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});router.delete('/deletewait/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;

    // Find the patient in the Waitinglist collection
    const waitingPatient = await Waiting.findOne({ 'WaitlistEntryfields.patientId': patientId });

    if (!waitingPatient) {
      return res.status(404).json({ error: 'Patient not found in the waiting list.' });
    }

    // Delete the patient from the Waitinglist collection
    await Waiting.deleteOne({ 'WaitlistEntryfields.patientId': patientId });

    // Delete the patient from the Patient collection
    await Patient.deleteOne({ patientId });

    res.status(200).json({ message: 'Patient deleted successfully.' });
  } catch (err) {
    next(err)
  }
})

module.exports = router
