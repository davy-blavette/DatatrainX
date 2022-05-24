const https = require("https");
const fs = require("fs");
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
//controller
const trainer = require("./api/routes/trainer");
app.use("/trainer", trainer);

https
    .createServer(
        // Provide the private and public key to the server by reading each
        // file's content with the readFileSync() method.
        {
            key: fs.readFileSync("../privkey.pem"),
            cert: fs.readFileSync("../cert.pem"),
        },
        app
    )
    .listen(PORT, () => {
        mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/datatrainx', {useNewUrlParser: true}).then((response) => {
            console.log(`Connected to MongoDB and server started on PORT ${PORT}`);
        }).catch((err) => {
            console.log(err);
        })
    });

// define first route
app.get("/", (req, res) => {
    res.redirect('https://datatrainx.akairnet.fr');
});