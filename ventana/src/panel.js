// La mascota no toma foco: un clic ahí lo alterna desde su propio evento.
const cerrarPorBlur = ({redimensionando,sobreGato}) => !redimensionando && !sobreGato
module.exports={cerrarPorBlur}
