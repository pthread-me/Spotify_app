const { error } = require("console");
const express = require("express");
const { url } = require("inspector");
const querystring = require("querystring")
const {request, get} = require("axios");
const { getLyrics, getSong } = require('genius-lyrics-api')
const {join} = require("path");
const bodyParser = require('body-parser')
const fs = require("node:fs")
const Readable = require('stream').Readable;


const app = express();
const SpotifyWebApi = require('spotify-web-api-node');
const {cache} = require("express/lib/application");
const axios = require("axios");

const client_id = "ffd3c86bf9f24392a54b12e85028da31";
const client_key = "6145451981f642dbb267e684a63dc164";
const lyrics_client = "Frq-MWqjqhm4MhB9KQ1hgC6eZaBMxU9RUAeAu8EaXKb1R0kJmpeyvHD5zw8c3Dn1"
const lyrics_key = "15sqUS2PW7hf9-21hGqfxg5P1MITGPie94tr9q73TJanVmZf8I6_2k4PnUSDIAvTSyDQvNRgiJD27SyPPDpBSA"
const redirect_uri = "http://localhost:5000/callback";
const jsonParser = bodyParser.json()

let token;
let lyric_token;


// credentials are optional
let spotifyApi = new SpotifyWebApi({
    clientId: 'fcecfc72172e4cd267473117a17cbd4d',
    clientSecret: 'a6338157c9bb5ac9c71924cb2940e1a7',
    redirectUri: redirect_uri
});

app.get("/", function(request, response){

    let state = Math.random(12).toString();
    let scope = 'user-read-private user-read-email user-modify-playback-state';
    
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


    //add try/cache
    const resource = await request(authOptions);

    token = resource.data['access_token']

    spotifyApi.setAccessToken(token)
    res.redirect("/lyric")
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


app.get("/home_page", async function(req, res){
    res.sendFile(join(__dirname, "Webpage/index.html"));

});

app.post("/lyric", jsonParser, async function(req, res){

    const song_name = req.body.song_name
    const artist_name = req.body.artist_name

    let lyrics = await search_lyrics(song_name, artist_name)

    await play_song(song_name, artist_name)
    res.send(lyrics)

})

async function play_song(song_name, artist_name){
    let search

    if (artist_name.localeCompare("") === 0){
        search = await spotifyApi.searchTracks("track:"+song_name)

    }else{
        search = await spotifyApi.searchTracks("track:"+song_name+" artist:"+artist_name)
    }

    let search_data = await search.body.tracks
    let song_id

    if(search_data.items.length>0){
        song_id = search_data.items[0].id
    }else{
        song_id = null
    }



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
}

async function search_lyrics(song, artist){

    let song_name = song.replaceAll(" ", "_")
    let lyrics = await check_tarnslated_cache(song_name)
    if(!lyrics.includes("AccessDenied")){
        return lyrics
    }

    let artist_name
    if (artist.localeCompare("") === 0){
        artist_name = " "
    }else{
        artist_name = artist
    }

    const options = {
        apiKey: lyric_token,
        title: song,
        artist: artist_name,
        optimizeQuery: true
    };

    lyrics = await getLyrics(options)


    let URL = "https://w2yc9644t9.execute-api.us-east-1.amazonaws.com/term_project/lyricscache/" + song_name + ".txt"
    let file = Readable.from(lyrics)
    await axios.put(encodeURI(URL), file)


    let a;
    await new Promise(r=> setTimeout(r, 1000))
    for(let i=0; i<10 && (a=await check_tarnslated_cache(song_name)).includes("AccessDenied"); i++){
        await new Promise(r=> setTimeout(r, 2000))
        console.log("wait")
    }
    return a
}


/**
 * function checks the s3 translated cache for the song if it was already translated
 * @param song_name The song to search for
 * @returns {Promise<string>} contains either the lyrics or "AccessDenied" if not
 */
async function check_tarnslated_cache(song_name){

    let URL = "https://w2yc9644t9.execute-api.us-east-1.amazonaws.com/term_project/translatedcache/" + song_name + ".txt/"
    const stream = (await fetch(encodeURI(URL))).body

    return await stream_to_string(stream)
}

/**
 * Function takes in a Readable stream and converts it into a plain text string
 * @param stream
 * @returns {Promise<string>}
 */
async function stream_to_string(stream){
    const lyrics = []
    for await (const s of stream){
        lyrics.push(Buffer.from(s))
    }

    return Buffer.concat(lyrics).toString('utf-8');
}


app.use(express.static(join(__dirname, 'Webpage')))

app.listen(5000, '0.0.0.0',function(){
    console.log("started listening")
});