const mongoose=require('mongoose');

//  const dischargeSchema=new mongoose.Schema({
  
//  patientName: String,
//          age:String,
//       gender:String,
//          //contactno:String,
//         patientId:String,
//             admissionDate:String,
//       dischargeDate: String,
//         dischargeTime:String,
       
//         wardId:{
//            type:String,
//            require:true
//       },
//         wardName:String,
//            bedNumber:{
//              type:String,
//         },
        
//            medicalAcuity:[{
//            type:String,
//                         require:true
        
//          }],
//          dischargeReasons:
//          [{ type:String,
//       require:true}],
//       extraDischargeReasons:[
//         {
//           type:String
//         }
//       ]

        
// })
// const Discharged=mongoose.model('Discharge',dischargeSchema);
//  module.exports=Discharged;

const dischargeSchema = new mongoose.Schema({
  patientName: String,
  age: String,
  dischargeId:String,
  gender: String,
  dischargeId:String,
  patientId: String,
  admissionDate: String,
  dischargeDate: String,
  dischargeTime: String,
  mortalityRate: {
    type: Number,
  },
  wardId: {
    type: String,
    required: true,
  },
  wardName: String,
  bedNumber: {
    type: String,
  },
  medicalAcuity: [
    {
      type: String,
      required: true,
    },
  ],
  dischargeReasons: [
    {
      type: String,
      required: true,
    },
  ],
  extraDischargeReasons: [
    {
      type: String,
    },
  ],
  
  
});

const Discharged = mongoose.model('Discharge', dischargeSchema);
module.exports = Discharged;
