
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    taskType: String,
    description: String,
  });

const waitingListSchema = new mongoose.Schema({
  WaitlistEntryfields: [{
    patientName: {
      type: String,
      required: true,
    },
    contactno: {
      type: String,
      required: true,
    },
    medicalAcuity:[{
        type:String,
        require:true
    
    }],
    bedNumber:String,
    wardId: {
      type: String,
    },
    wardName: {
      type: String,
    },
    priority: {
      type: String,
      //enum: ["High", "Low", "Medium"],
      required: true,
    },
    patientId: {
      type: String,
    },
    age: {
      type: String,
    },
    gender: {
      type: String,
    },
    admissionDate: {
      type: String,
    },
    admissionTime: {
      type: String,
    },
    admittingDoctors:[{
        type:String,
    }],
    assignedNurse: String,
    abhaNo:String,
    address:[{
        doorno:String,
        streetname:String,
        district:String,
        state:String,
        country:String,
        pincode:String,
        
        },
        ],
        tasks: [
            {
              taskType: String,
              description: String,
            },
          ],
          tasks: [taskSchema],
          status:String,
  }],
});

const Waiting = mongoose.model("Waiting", waitingListSchema);

module.exports = Waiting;
