/*!
* Start Bootstrap - Scrolling Nav v5.0.6 (https://startbootstrap.com/template/scrolling-nav)
* Copyright 2013-2023 Start Bootstrap
* Licensed under MIT (https://github.com/StartBootstrap/startbootstrap-scrolling-nav/blob/master/LICENSE)
*/
//
// Scripts
//

const form = document.getElementById("my_form")
form.addEventListener("submit", async function (event) {
    event.preventDefault()


    const formData = new FormData(form)
    const song = formData.get("song")
    const artist = formData.get("artist")

    const translation = document.getElementById("translated")

    // Send data to the backend
    fetch('/lyric', {
        method: 'post',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({song_name: song, artist_name: artist})
    })
        .then(response => response.text())
        .then(data => {
            translation.innerHTML = data
            console.log(data);
        })
        .catch(error => {
            console.error('Error:', error);
        });
})
