const mongoose = require('mongoose');
const bedSchema = new mongoose.Schema({
  wards:[
    {
      wardName: String,
      wardId:String,
      wardType:String,
      beds: [
        {

          bedNumber: String,
          status: { type: String, 
            enum: ['available', 'occupied'], default: 'available' },

          //status: String, // "available" or "occupied"
          patientId:String,
          patientName:String,
          age:String,
          gender:String,
contactno:String,
medicalAcuity:String,
        }]
    },
  ],
});
const Bed = mongoose.model('Wards', bedSchema);
module.exports = Bed;

