
//Latitud y longitud y zoom
const map=L.map('map-template').setView([51.505, -0.09], 10);

//
const socket=io();

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

map.locate({enableHighAccuracy:true});

//encontrar ubicación
map.on('locationfound',e => {
		const coords=[51,-0.9];
		const marker=L.marker(coords);
		marker.bindPopup('Estoy aquí');
		map.addLayer(marker);
		socket.emit('userCoordinates',51);

});

socket.on('userNewCoordinates',(coords)=>{
	console.log('nuevo usuario conectado');
	console.log(coords);
	const marker=L.marker([52,-0.9]);
	marker.bindPopup('HolixD');
	map.addLayer(marker);
	//map.addLayeuserNewCoordinates(marker);
});

////agregar un marcador
//const marker=L.marker([51.505,-0.9]);
//marker.bindPopup('Holi');
//map.addLayer(marker);

