const mongoose = require('mongoose');
const taskSchema = new mongoose.Schema({
  taskType: String,
  description: String,
});

const patientSchema = new mongoose.Schema({
  patientName: String,
  age: String,
  gender: String,
  contactno: String,
  patientId: String,
  wardId: String,
  wardName: {
    type: String,
    required: true,
  },
  bedNumber: {
    type: String,
  },
  medicalAcuity: [{
    type: String,
    require: true
  }],
  admittingDoctors: [{
    type: String,
  }],
  admissionDate: String,
  admissionTime: String,
  priority: { // Ensure that priority is added to the schema
    type: String,
  },
  address: [{
    doorno: String,
    streetname: String,
    district: String,
    state: String,
    country: String,
    pincode: String,
  }],
  assignedNurse: String,
  abhaNo: String,
  tasks: [taskSchema], 
  infectionStatus:String,
  riskScore:String,
 
});

const Patient = mongoose.model('Patient', patientSchema);
module.exports = Patient;
