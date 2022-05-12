const bodyParser = require("body-parser");
const morgan = require("morgan");
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());


//configure body parser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
//configure body-parser ends here

app.use(morgan("dev")); // configire morgan

// define first route
app.get("/", (req, res) => {
    res.json("DataTrainX Welcome!");
});

//controller
const trainer = require("./api/routes/trainer");
app.use("/trainer", trainer);

//Initiate MongoDB and start backend
app.listen(PORT, (uri, callback) => {
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/datatrainx', {useNewUrlParser: true}).then((response) => {
        console.log(`Connected to MongoDB and server started on PORT ${PORT}`);
    }).catch((err) => {
        console.log(err);
    })
});