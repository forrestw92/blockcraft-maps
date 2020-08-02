let markerArray = [];
let map = null;
let markerVisibility = true;
let playerAvatars = []

function ProjectionCartesian() {};

ProjectionCartesian.prototype.fromLatLngToPoint = function (latLng) {
    return new google.maps.Point(latLng.lng() * 512 / 32, latLng.lat() * 512 / 32);
};

ProjectionCartesian.prototype.fromPointToLatLng = function (point, noWrap) {
    return new google.maps.LatLng(point.y / 512 * 32, point.x / 512 * 32, noWrap);
};

/**
 * Return minecraft avatar image of user.
 * @param {string} username - Minecraft username
 */
function getPlayerAvatar(username) {
    return fetch(`https://playerdb.co/api/player/minecraft/${username}`)
        .then(res => res.text())
        .then(text => JSON.parse(text))
        .then((ec) => {
            if (ec.error) {
                throw new Error(`Error looking up username "${username}"`)
            }
            return ec;
        })
        .then(({
            data
        }) => {
            if (!data.player.avatar) {
                throw new Error(`No avatar for player "${username}"`)
            }
            return data.player.avatar
        })
}

/**
 * Generates Icon from image url
 * @param {string} url - Image url
 */
function GenerateIcon(url) {
    return {
        url,
        size: new google.maps.Size(64, 64),
        scaledSize: new google.maps.Size(32, 32),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(16, 16),
    }
}


/**
 *
 * @param {number} x - World X
 * @param {number} z - World Z
 * @param {string} iconUrl - Image url
 * @param {string} title - Info window title
 */
function addWorldMarker(x, z, iconUrl, title) {
    const offset = 128;
    const icon = GenerateIcon(iconUrl);
    const marker = new google.maps.Marker({
        position: new google.maps.LatLng(z / 512 * 2, (x / 512 * 2) + offset),
        map: map,
        icon,
        name: title,
        title: `${title} (${x},${z})`,
    });

    const infowindow = new google.maps.InfoWindow({
        content: `<span id="markerUsername">${title}</span>X: ${x}<br>Z: ${z}`,
        pixelOffset: new google.maps.Size(-16, 0)
    });
    marker.infowindow = infowindow;
    marker.addListener('click', function () {
        infowindow.open(map, marker);
    });
    markerArray.push(marker);
}
/**
 * Places a user avatar as a marker on the map
 * @param {number} x - World X
 * @param {number} z - World Z
 * @param {string} avatar - Minecraft avatar url
 * @param {string} username - Minecraft username
 */
async function addPlayerMarker(x, z, avatar,username) {
    const offset = 128;
    const icon = GenerateIcon(avatar)
    const marker = new google.maps.Marker({
        position: new google.maps.LatLng(z / 512 * 2, (x / 512 * 2) + offset),
        map: map,
        icon,
        username,
        title: `${username} (${x},${z})`,
    });
    const infowindow = new google.maps.InfoWindow({
        content: `<span id="markerUsername">${username}</span>X: ${x}<br>Z: ${z}`,
        pixelOffset: new google.maps.Size(-16, 0)
    });
    marker.infowindow = infowindow;
    marker.addListener('click', function () {
        infowindow.open(map, marker);
    });
    markerArray.push(marker);
}

/**
 * Returns world coords of lat lng
 * @param {Object} latLng - LatLng to process world coords
 */
function getWorldPosition(latLng) {
    const lat = latLng.lat();
    const lng = latLng.lng();
    const z = Math.floor(lat * 512 / 2);
    const x = Math.floor((lng - 128) * 256);
    return {
        x,
        z
    }
}
function appendWorldPointSidebar(x,z,icon,title) {
    const sidebar = document.getElementById("worldPoints");
    const player = document.createElement("li");
    const avatar = document.createElement("div")
    const avatarImg = document.createElement("img")
    const username = document.createElement("div")
    const position = document.createElement("div")
    avatar.className = "avatar"
    avatarImg.src = icon;
    username.innerText = title;
    username.className = "username"
    position.className= "position"
    position.innerHTML =
    `
    X: ${x}
    Z: ${z}
    `
    avatar.appendChild(avatarImg);
    player.append(avatar,username,position)
    sidebar.append(player)

    //On sidebar world list click. Pan to position on map.
    player.addEventListener("click",() => {
        const foundMarker = markerArray.find(marker => marker.name === title)
        map.panTo(foundMarker.position);
    })

}
/**
 *
 * @param {number} x - World X
 * @param {number} z - World Z
 * @param {string} userAvatar - Minecraft avatar url
 * @param {string} name - Minecraft username
 */
function appendPlayerSidebar(x,z,userAvatar,name) {
    const sidebar = document.getElementById("playerlist");
    const player = document.createElement("li");
    const avatar = document.createElement("div")
    const avatarImg = document.createElement("img")
    const username = document.createElement("div")
    const position = document.createElement("div")
    avatar.className = "avatar"
    avatarImg.src = userAvatar;
    username.innerText = name;
    username.className = "username"
    position.className= "position"
    position.innerHTML =
    `
    X: ${x}
    Z: ${z}
    `
    avatar.appendChild(avatarImg);
    player.append(avatar,username,position)
    sidebar.append(player)

    //On sidebar player list click. Pan to position on map.
    player.addEventListener("click",() => {
        const foundMarker = markerArray.find(marker => marker.username === name)
        map.panTo(foundMarker.position);
    })

}

function initialize() {

    const mapOptions = {
        center: new google.maps.LatLng(0, 128),
        zoom: 4,
        streetViewControl: false,
        zoomControl: true,
        panControl: false,
        scaleControl: false,
        mapTypeControlOptions: {
            mapTypeIds: ['overworld']
        }
    };

    //Create bounds for overworld map
    const strictBounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(-9.012198383175992, 118.98517363290132),
        new google.maps.LatLng(9.079372547136284, 137.06744321862143)
    );


    //Init map variable to a new google maps instance
    map = new google.maps.Map(document.getElementById('map'), mapOptions);

    //Map out of bounds event listener.
    google.maps.event.addListener(map, 'dragend', function () {
        if (strictBounds.contains(map.getCenter())) return;

        // We're out of bounds - Move the map back within the bounds
        const c = map.getCenter(),
            x = c.lng(),
            y = c.lat(),
            maxX = strictBounds.getNorthEast().lng(),
            maxY = strictBounds.getNorthEast().lat(),
            minX = strictBounds.getSouthWest().lng(),
            minY = strictBounds.getSouthWest().lat();

        if (x < minX) x = minX;
        if (x > maxX) x = maxX;
        if (y < minY) y = minY;
        if (y > maxY) y = maxY;

        map.setCenter(new google.maps.LatLng(y, x));
    });

    //Create overworld map from overworld image tiles.
    const mapTypeOverworld = new google.maps.ImageMapType({
        getTileUrl: function (coord, zoom) {
            const z = Math.pow(2, zoom - 4);
            return 'overworld/images/z' + z + '/' + ((coord.x - (128 * z))) + ',' + coord.y + '.png';
        },
        tileSize: new google.maps.Size(256, 256),
        maxZoom: 7,
        minZoom: 3,
        name: 'Overworld'
    });



    // use the custom latitude and logitude projection
    mapTypeOverworld.projection = new ProjectionCartesian();


    // add the map type to the map
    map.mapTypes.set('overworld', mapTypeOverworld);
    map.setMapTypeId('overworld');

    // Gets block craft marker info from json host.
    fetch("https://api.jsonbin.io/b/5f1dc6d9c1edc466175ec3e9/3")
        .then(res => res.json())
        .then( ({
            world,
            bases
        }) => {
            bases.forEach(({
                x,
                z,
                username
            }) => {
                getPlayerAvatar(username).then(avatar => {
                    addPlayerMarker(x, z, avatar,username)
                    appendPlayerSidebar(x,z,avatar,username)
                });

            })
            world.forEach(({
                x,
                z,
                icon,
                title
            }) => {
                addWorldMarker(x, z, icon, title)
                appendWorldPointSidebar(x,z,icon,title)
            })
        }).then


}
initialize()