const { error } = require("console");
const express = require("express");
const { url } = require("inspector");
const querystring = require("querystring")
const {request} = require("axios");
const {join} = require("path");

const app = express();


const client_id = "ffd3c86bf9f24392a54b12e85028da31";
const client_key = "6145451981f642dbb267e684a63dc164";
const redirect_uri = "http://localhost:5000/callback";
let token;
let spotifyApi;


app.get("/", function(request, response){

    var state = Math.random(12).toString();
    var scope = 'user-read-private user-read-email';
    
    response.redirect(
        "https://accounts.spotify.com/authorize?" + querystring.stringify({
            response_type: "code",
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        })
    );

});

app.get("/callback", async function(req, res){
    let code = req.query.code || null;
    let state = req.query.state || null;
    let scope = 'user-read-private user-read-email';

    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        method: 'post',
        data: 'code=' + code + '&redirect_uri=' + redirect_uri + '&grant_type=authorization_code',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_key).toString('base64')
        },
        json: true
    };

    const resource = await request(authOptions);

    const data = resource.data['access_token']
    token = data

    console.log(data)
    res.redirect("/home_page" + querystring.stringify())
});


app.get("/home_page", async function(req, res){

    res.sendFile(join(__dirname, "views/index.html"));

    const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
            Authorization: 'Bearer ' + token
        }
    });

    const data = await response.json()
    console.log(data)
    //res.send(data)
});


app.listen(5000, function(){
    console.log("started app\n");
});