const express = require("express")
const mysql= require("mysql2")
const path = require('path') 
var bodyParser=require('body-parser')
const req = require("express/lib/request")
const res = require("express/lib/response")
var app=express()
var con=mysql.createConnection({
    host:'localhost',
    user:'root',
    password:'n0m3l0',
    database:'proyectoPanaderia'
})
con.connect();

app.use(bodyParser.json())

app.use(bodyParser.urlencoded({
    extended:true
}))
app.use(express.static('public'))

app.listen(10000,()=>{
    console.log('Servidor escuchando en el puerto 10000')
})
