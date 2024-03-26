const { error } = require("console");
const express = require("express");
const { url } = require("inspector");
const querystring = require("querystring")
const {request, get} = require("axios");
const { getLyrics, getSong } = require('genius-lyrics-api')
const {join} = require("path");

const app = express();


const client_id = "ffd3c86bf9f24392a54b12e85028da31";
const client_key = "6145451981f642dbb267e684a63dc164";

const lyrics_client = "Frq-MWqjqhm4MhB9KQ1hgC6eZaBMxU9RUAeAu8EaXKb1R0kJmpeyvHD5zw8c3Dn1"
const lyrics_key = "15sqUS2PW7hf9-21hGqfxg5P1MITGPie94tr9q73TJanVmZf8I6_2k4PnUSDIAvTSyDQvNRgiJD27SyPPDpBSA"

const redirect_uri = "http://localhost:5000/callback";

let token;
let lyric_token;

const SpotifyWebApi = require('spotify-web-api-node');

// credentials are optional
let spotifyApi = new SpotifyWebApi({
    clientId: 'fcecfc72172e4cd267473117a17cbd4d',
    clientSecret: 'a6338157c9bb5ac9c71924cb2940e1a7',
    redirectUri: redirect_uri
});

app.get("/", function(request, response){

    var state = Math.random(12).toString();
    var scope = 'user-read-private user-read-email user-modify-playback-state';
    
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
    let scope = 'user-read-private user-read-email user-modify-playback-state';

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

    spotifyApi.setAccessToken(token)
    console.log(data)
    res.redirect("/lyric")
});


app.get("/home_page", async function(req, res){

    //res.sendFile(join(__dirname, "views/index.html"));

    const song = "my name is dark"
    const type = "track"
    const artist = "grimes"

    const user_data = await fetch('https://api.spotify.com/v1/me', {
        headers: {
            Authorization: 'Bearer ' + token
        }
    });

    const options = {
        apiKey: lyric_token,
        title: 'Posthumous Forgiveness',
        artist: 'Tame Impala',
        optimizeQuery: true
    };

    const lyrics_data = await getLyrics(options)


    let search = await spotifyApi.searchTracks("track:"+song+" artist:"+artist)
    let search_data = await search.body.tracks
    const  song_id = search_data.items[0].id

    //search = await spotifyApi.getTrack(song_id)
    //let song_url = search.body.external_urls.spotify

    const change = await fetch("https://api.spotify.com/v1/me/player/play", {
        method: "put",
        headers:{
            Authorization: 'Bearer '+token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            uris: ["spotify:track:"+song_id]
        })
    })

    console.log(change)

});

app.get("/lyric", async function(req, res){
    res.redirect(
        "https://api.genius.com/oauth/authorize?" + querystring.stringify({
            response_type: "code",
            client_id: lyrics_client,
            scope: "me",
            redirect_uri: "http://localhost:5000/lyric_callback",
            state: 1
        })
    );
})

app.get("/lyric_callback", async function(req, res){
    const code = req.query.code
    const lyric_auth = {
        url: 'https://api.genius.com/oauth/token',
        method: 'post',
        data: {
            code: code,
            client_secret: lyrics_key,
            grant_type: "authorization_code",
            client_id: lyrics_client,
            redirect_uri: "http://localhost:5000/lyric_callback",
            response_type: "code"
        }
    };

    const lyric_res = await request(lyric_auth)
    lyric_token =  lyric_res.data['access_token']

    res.redirect("/home_page")
})



app.listen(5000, function(){

});