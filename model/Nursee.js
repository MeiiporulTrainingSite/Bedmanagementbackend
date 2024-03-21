const mongoose = require('mongoose');

const nurseSchema = new mongoose.Schema({
  nurseId:{
    type:String,
    required:true
  },
  nurseName:{
    type:String,
    require:true
  }
});

const nurse = mongoose.model('nurse', nurseSchema);

module.exports = nurse;

