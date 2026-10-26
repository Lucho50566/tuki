/* Tuki digital — mazo de desafíos original (texto propio, no copiado del mazo físico) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DECK = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const CATS = {
    tierno:    { label: 'Tierno',    color: '#f0a6a6', ink: '#2a1116', hint: 'Cercanía' },
    divertido: { label: 'Divertido', color: '#f2c14e', ink: '#2a1e05', hint: 'Risa' },
    complice:  { label: 'Cómplice',  color: '#9b8cf0', ink: '#150f2e', hint: 'Verdad' },
    atrevido:  { label: 'Atrevido',  color: '#ef6f8e', ink: '#2a0713', hint: 'Piel' },
    hot:       { label: 'Hot 18+',   color: '#c9314f', ink: '#fff1f3', hint: 'Solo adultos' }
  };

  let n = 0;
  const c = (cat, intense, text) => ({ id: 'c' + (++n), cat, intense, text });

  const cards = [
    // ── TIERNO ──────────────────────────────────────────────
    c('tierno', 1, 'Abrazo de treinta segundos, sin decir nada.'),
    c('tierno', 1, 'Decile tres cosas que te gustan de tu pareja, mirándola a los ojos.'),
    c('tierno', 1, 'Mandale un mensaje contando tu primer recuerdo juntos.'),
    c('tierno', 1, 'Ponele una canción que te la recuerde y bailen un minuto donde estén.'),
    c('tierno', 1, 'Contale algo que nunca le contaste.'),
    c('tierno', 1, 'Elegí una foto vieja de los dos y contá qué sentías ese día.'),
    c('tierno', 1, 'Escribí una línea en un papel y dejásela donde la encuentre.'),
    c('tierno', 1, 'Preguntale cómo está de verdad, y escuchá dos minutos sin interrumpir.'),
    c('tierno', 1, 'Contale qué pensaste la primera vez que la viste.'),
    c('tierno', 1, 'Agradecele algo que hace todos los días y nadie le reconoce.'),
    c('tierno', 1, 'Dale un beso en la frente y decile “te elijo”.'),
    c('tierno', 1, 'Abrazala por la espalda mientras hace algo de la casa, en silencio.'),
    c('tierno', 1, 'Mirá una foto de cuando eran chicos y adiviná cómo era el otro.'),
    c('tierno', 1, 'Decile “sos mi lugar favorito” y explicá por qué.'),
    c('tierno', 1, 'Elegí una canción para “ustedes” y que quede como la del mes.'),
    c('tierno', 1, 'Hacé una lista de tres planes baratos para el próximo finde.'),
    c('tierno', 1, 'Contale cómo te imaginás un domingo perfecto con ella o él.'),
    c('tierno', 1, 'Decile que la extrañás, aunque estén en la misma habitación.'),
    c('tierno', 1, 'Repetí la primera cita: contá dónde fue y qué pidieron.'),
    c('tierno', 2, 'Contale un miedo que tengas y no le hayas dicho.'),
    c('tierno', 2, 'Pedile perdón por algo que quedó pendiente, aunque sea chiquito.'),
    c('tierno', 2, 'Decile qué te gustaría que hicieran juntos en cinco años.'),
    c('tierno', 2, 'Contale qué es lo que más te gusta de cómo te trata.'),
    c('tierno', 2, 'Mandale un audio de un minuto diciendo todo lo que no decís.'),
    c('tierno', 2, 'Preguntale cuál fue el día en que se sintió más querida por vos.'),
    c('tierno', 2, 'Preguntale qué necesita de vos esta semana.'),

    // ── DIVERTIDO ───────────────────────────────────────────
    c('divertido', 1, 'Imitá a tu pareja durante un minuto entero. Si se ríe, ganaste.'),
    c('divertido', 1, 'Hacé una selfie ridícula y ponela de fondo de pantalla.'),
    c('divertido', 1, 'Hablá con acento extranjero hasta que te diga basta.'),
    c('divertido', 1, 'Cantale el estribillo de una canción romántica, mal y fuerte.'),
    c('divertido', 1, 'Elegí un apodo nuevo para ella o él y usalo toda la noche.'),
    c('divertido', 1, 'Hacé diez sentadillas contando como locutor de fútbol.'),
    c('divertido', 1, 'Contá un chiste malo. Si no se ríe, contá otro.'),
    c('divertido', 1, 'Bailá reggaetón sin música durante cuarenta segundos.'),
    c('divertido', 1, 'Hacé una declaración de amor estilo telenovela, de rodillas.'),
    c('divertido', 1, 'Inventen un idioma de dos palabras y hablen solo así diez minutos.'),
    c('divertido', 1, 'Mandale un mensaje a un amigo contando algo lindo de tu pareja.'),
    c('divertido', 1, 'Hacé de cuenta que es una entrevista y contá por qué querés el puesto de “pareja”.'),
    c('divertido', 1, 'Grabá un video de tres segundos actuando una escena de película.'),
    c('divertido', 1, 'Que te haga cosquillas quince segundos sin reírte.'),
    c('divertido', 1, 'Adiviná qué canción tararea con la boca cerrada.'),
    c('divertido', 1, 'Elegí un objeto de la casa y vendelo como si costara una fortuna.'),
    c('divertido', 1, 'Hacé un rap con tres cosas que pasaron hoy.'),
    c('divertido', 1, 'Ponele música épica a una tarea doméstica y hacela como héroe.'),
    c('divertido', 2, 'Dejá que te dibuje algo en la cara con delineador.'),
    c('divertido', 2, 'Elegí el peor outfit del placard del otro y desfilá.'),
    c('divertido', 2, 'Armá un peinado nuevo en el otro en menos de un minuto.'),
    c('divertido', 2, 'Imitá a alguien que los dos conozcan y que adivine quién es.'),

    // ── CÓMPLICE ────────────────────────────────────────────
    c('complice', 2, 'Contale un plan que tengas en la cabeza y nunca pusiste en marcha.'),
    c('complice', 2, 'Elijan un sueño de los dos y den el primer paso hoy, aunque sea mínimo.'),
    c('complice', 2, 'Cuenten cada uno un secreto que no sea grave, pero que no sepan.'),
    c('complice', 2, 'Elegí una regla de la casa que quieras cambiar y proponé cómo.'),
    c('complice', 2, 'Decile qué te gustaría que hiciera más seguido.'),
    c('complice', 2, 'Armen juntos una lista de cinco cosas para hacer antes de fin de año.'),
    c('complice', 2, 'Decidan algo que los dos venían evitando y pónganle fecha.'),
    c('complice', 2, 'Escriban una carta para abrir en un año. Guárdenla.'),
    c('complice', 2, 'Preguntale qué admira de vos que nunca te dijo.'),
    c('complice', 2, 'Cuenten qué harían si se quedaran solos un fin de semana sin plata.'),
    c('complice', 2, 'Elijan una cosa de la casa que los represente y expliquen por qué.'),
    c('complice', 2, 'Preguntale qué necesita para sentirse más liviana o liviano esta semana.'),
    c('complice', 3, 'Preguntale qué cambiaría de su vida si no tuviera miedo.'),
    c('complice', 3, 'Preguntale qué es lo que más le cuesta de estar en pareja.'),
    c('complice', 3, 'Contale algo que te dé celos y por qué, sin pelear.'),
    c('complice', 3, 'Preguntale cuándo se sintió más sola o solo estando con vos.'),
    c('complice', 3, 'Decile qué te da miedo perder de ustedes.'),
    c('complice', 3, 'Cuenten cómo se ven a los sesenta, juntos en una mesa.'),

    // ── ATREVIDO ────────────────────────────────────────────
    c('atrevido', 2, 'Dale un beso de diez segundos donde estén parados.'),
    c('atrevido', 2, 'Susurrale al oído algo que te gusta de su cuerpo.'),
    c('atrevido', 2, 'Masaje de manos y cuello durante cinco minutos, sin apuro.'),
    c('atrevido', 2, 'Elegí la prenda que más te gusta de ella o él y decile por qué.'),
    c('atrevido', 2, 'Bailen pegados una canción lenta, sin hablar.'),
    c('atrevido', 2, 'Dejá que te dé un beso con los ojos cerrados y adiviná dónde.'),
    c('atrevido', 2, 'Hagan un pacto: esta noche, nada de celulares después de las once.'),
    c('atrevido', 2, 'Sacate una foto linda y mandásela solo a ella o él.'),
    c('atrevido', 2, 'Cinco minutos de mimos sin hablar, en la cama o el sillón.'),
    c('atrevido', 2, 'Escribile un mensaje atrevido y que lo lea delante tuyo.'),
    c('atrevido', 3, 'Besala en el cuello y seguí como si nada.'),
    c('atrevido', 3, 'Contale una fantasía que tengas, en voz baja.'),
    c('atrevido', 3, 'Beso en la espalda, sin aviso.'),
    c('atrevido', 3, 'Decile al oído qué te dan ganas de hacer ahora mismo.'),
    c('atrevido', 3, 'Elegí un lugar de la casa y decile “nos vemos ahí en cinco minutos”.'),
    c('atrevido', 3, 'Preguntale qué le gustaría que hagas más seguido, y hacelo hoy.'),

    // ── HOT 18+ (contenido adulto, consentido) ───────────────
    c('hot', 4, 'Bajale el cierre con los dientes. Sin apuro.'),
    c('hot', 4, 'Decile al oído, con detalle, todo lo que le vas a hacer esta noche.'),
    c('hot', 4, 'Sacate la ropa interior y ponésela en la mano. Que decida qué hacer.'),
    c('hot', 4, 'Besala en el cuello y bajá hasta el hombro. Diez segundos, sin apuro.'),
    c('hot', 4, 'Poné su mano donde quieras que te toque. No digas nada.'),
    c('hot', 4, 'Desnudala de a una prenda, sin usar las manos.'),
    c('hot', 4, 'Beso de lengua de un minuto entero, sin tocarse con las manos.'),
    c('hot', 4, 'Elegí un lugar de la casa y decile: “te espero ahí en cinco minutos”. Nada más.'),
    c('hot', 4, 'Contale una fantasía con lujo de detalles y que decida si se cumple hoy.'),
    c('hot', 4, 'Tocala por encima de la ropa hasta que te pida que pares.'),
    c('hot', 4, 'Hacele sexo oral dos minutos. Ella no puede hablar, solo respirar.'),
    c('hot', 4, 'Sentate encima suyo, vestida, y movete despacio hasta que se le note.'),
    c('hot', 4, 'Decile qué parte de su cuerpo te excita más y demostralo ahí mismo.'),
    c('hot', 4, 'Que te ate las manos con lo que encuentre y te deje así un minuto.'),
    c('hot', 4, 'Sacate la remera y que te recorra la espalda con la boca.'),
    c('hot', 4, 'Pongan un audio o un video excitante y mírenlo juntos cinco minutos. Comenten.'),
    c('hot', 4, 'Hacela acabar una vez antes de que ella te toque a vos.'),
    c('hot', 4, 'Sexo en un lugar de la casa donde nunca lo hicieron.'),
    c('hot', 4, 'Decile “quiero que me hagas tal cosa” y esperá a que lo haga.'),
    c('hot', 4, 'Beso negro de treinta segundos.'),
    c('hot', 4, 'Que te susurre sin filtro lo que te haría, mientras te toca por encima de la ropa.'),
    c('hot', 4, 'Sacate el corpiño por debajo de la remera y que lo tenga en la mano hasta el final de la ronda.'),
    c('hot', 4, 'Que te ponga un preservativo con la boca.'),
    c('hot', 4, 'Elijan una postura que nunca probaron y prueben un minuto.'),
    c('hot', 4, 'Hielo: pasalo por su cuerpo hasta que se derrita donde elijas.'),
    c('hot', 4, 'Que te diga la cosa más sucia que pensó de vos esta semana, y después cúmplala.'),
    c('hot', 4, 'Terminá la ronda con las manos: vos hacés, la otra persona mira.'),
    c('hot', 4, 'Decile al oído: “no te dejo acabar hasta que me lo pidas”.'),
    c('hot', 4, 'Foto o video de los dos, solo para ustedes. No sale de ese teléfono.'),
    c('hot', 4, 'Veinte minutos de habitación cerrada, sin celulares. Lo que pase, pasa.'),
    c('hot', 4, 'Besala despacio mientras le sostenés la cara con las dos manos.'),
    c('hot', 4, 'Decile que se desvista y que te espere en la cama. Vos llegás cuando quieras.'),
    c('hot', 4, 'Hacele un striptease de un minuto. Ella no puede tocar, solo mirar.'),
    c('hot', 4, 'Poné su mano en tu pecho y dejá que baje sola.'),
    c('hot', 4, 'Tocala por debajo de la ropa, muy despacio, mientras le hablás de otra cosa.'),
    c('hot', 4, 'Que te diga qué quiere hacerte y que lo haga sin hablar.'),
    c('hot', 4, 'Beso en la nuca, después en la espalda, después donde ella diga.'),
    c('hot', 4, 'Desnudos los dos, abrazados, cinco minutos sin hacer nada más.'),
    c('hot', 4, 'Que elija: te da o te recibe. Sin preguntar más.'),
    c('hot', 4, 'Usá la boca para bajarle el cierre y no pares hasta que te frene.'),
    c('hot', 4, 'Sentados frente a frente, mirándose, se tocan cada uno. Sin hablar.'),
    c('hot', 4, 'Decile al oído cuánto te gusta y demostralo con la boca en el cuello.'),
    c('hot', 4, 'Elijan un número del 1 al 10. Ese número de minutos, lo que quieran.'),
    c('hot', 4, 'Terminá la ronda como ella te pida. Sin discutir.')
    ,
    c('hot', 4, 'Decile “quedate quieta” y hacé todo vos, despacio.'),
    c('hot', 4, 'Bajale la remera hasta la cintura y besá lo que aparezca.'),
    c('hot', 4, 'Que te cuente un sueño erótico completo, sin saltearse nada.'),
    c('hot', 4, 'Elegí vos la próxima carta de la otra persona y jugala por ella.')
  ];

  const LEVELS = {
    suave: { label: 'Suave', max: 1, hint: 'Para empezar tranquilos' },
    normal: { label: 'Normal', max: 2, hint: 'Como el mazo clásico' },
    picante: { label: 'Picante', max: 3, hint: 'Todo lo atrevido' },
    hot18: { label: 'Hot 18+', max: 4, hint: 'Solo adultos', adult: true }
  };

  function build(level, extra) {
    const L = LEVELS[level] || LEVELS.normal;
    const base = L.adult ? cards.filter(k => k.intense >= 3) : cards.filter(k => k.intense <= L.max);
    const all = base.concat(extra || []);
    return all.slice();
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  return { cards, cats: CATS, levels: LEVELS, build, shuffle };
});
