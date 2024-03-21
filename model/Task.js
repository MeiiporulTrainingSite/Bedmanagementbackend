const mongoose = require('mongoose')

const taskSchema = new mongoose.Schema({

taskType:{
    type:String,
    required:true,
 },
description:{
    type:String,
    required:true
 } 

})

const task = mongoose.model('tasks',taskSchema)

module.exports = task
