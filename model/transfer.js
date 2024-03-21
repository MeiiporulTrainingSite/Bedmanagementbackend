const mongoose = require('mongoose');
const transfersSchema = new mongoose.Schema({
  patientName: String,
  age: String,
  gender: String,
  contactno: String,
  patientId: String,
  transferId:String,
  currentWardId: String,
  currentBedNumber: String,
  transferWardId: String,
  transferBedNumber: String,
  
  medicalAcuity: [String],
  transferReasons: [String],
  extraTransferReason: String,
});
const Transfers = mongoose.model('Transfer', transfersSchema);
module.exports = Transfers;