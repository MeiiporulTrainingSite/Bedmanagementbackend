const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  doctorId: {
    type: String,
    unique:true
  },
  admittingDoctors: {
    type: String,
  }
  
});

const doctor = mongoose.model('Doc', doctorSchema);

module.exports = doctor;
