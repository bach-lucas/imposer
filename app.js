const $ = (selector) => document.querySelector(selector);
const toast = $('#toast');
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function setLocked(locked) {
  document.body.classList.toggle('is-locked', locked);
  $('#lockToggle').checked = locked;
  showToast(locked ? 'Interação travada — os cliques passam para o jogo' : 'Interação liberada');
}

$('#lockToggle').addEventListener('change', (event) => setLocked(event.target.checked));
$('#lockHero').addEventListener('click', () => setLocked(!$('#lockToggle').checked));

$('#visibilityToggle').addEventListener('change', (event) => {
  document.body.classList.toggle('is-hidden', !event.target.checked);
  showToast(event.target.checked ? 'Overlay visível' : 'Overlay oculto — pressione F8 para voltar');
});

$('#opacityRange').addEventListener('input', (event) => {
  const value = event.target.value;
  $('#opacityValue').textContent = `${value}%`;
  event.target.style.background = `linear-gradient(90deg, var(--orange) 0 ${value}%, #3a3934 ${value}%)`;
});

['#launchOverlay', '#heroLaunch'].forEach((selector) => {
  $(selector).addEventListener('click', () => showToast('Overlay aberto — pronto para usar sobre o jogo'));
});

$('#newContent').addEventListener('click', () => showToast('Escolha um arquivo, vídeo, mapa ou nota para adicionar'));
$('#addLibrary').addEventListener('click', () => showToast('Novo workspace criado'));

document.addEventListener('keydown', (event) => {
  if (event.key === 'F8') {
    event.preventDefault();
    $('#visibilityToggle').click();
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'l') {
    event.preventDefault();
    setLocked(!$('#lockToggle').checked);
  }
});
