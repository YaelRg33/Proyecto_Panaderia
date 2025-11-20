module.exports = io => {
	io.on('connection',(socket)=>{
			console.log('conectado');
			
			socket.on('userCoordinates', coords => {
			console.log(coords);
			//para mandarles a todos los usuarios conectados
			socket.broadcast.emit('userNewCoordinates',coords)
			});
		});
	}
