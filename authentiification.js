const msg = document.getElementById('auth-message')
const titre = document.getElementById('auth-titre')
const champsInscription = document.getElementById('champs-inscription')
const btnValider = document.getElementById('btn-valider')
const lienMode = document.getElementById('lien-mode')

let modeInscription = false

// Basculer entre Connexion et Inscription
lienMode.addEventListener('click', (e) => {
  e.preventDefault()
  modeInscription = !modeInscription
  msg.textContent = ''

  champsInscription.hidden = !modeInscription
  titre.textContent = modeInscription ? 'Inscription' : 'Connexion'
  btnValider.textContent = modeInscription ? "S'inscrire" : 'Se connecter'
  lienMode.textContent = modeInscription
    ? 'Déjà un compte ? Se connecter'
    : "Pas de compte ? S'inscrire"
})

// Vérifie que l'email est de l'UQAC
function emailUqac(email) {
  return /@(etu\.)?uqac\.ca$/i.test(email)
}

// Bouton principal
btnValider.addEventListener('click', () => {
  if (modeInscription) inscription()
  else connexion()
})

// INSCRIPTION
async function inscription() {
  const username = document.getElementById('username').value.trim()
  const email = document.getElementById('email').value.trim()
  const birthdate = document.getElementById('birthdate').value
  const password = document.getElementById('password').value

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    msg.textContent = 'Nom : 3 à 20 caractères, lettres, chiffres ou _ seulement.'
    return
  }
  if (!emailUqac(email)) {
    msg.textContent = 'Utilise ton email @uqac.ca ou @etu.uqac.ca.'
    return
  }
  if (!birthdate) {
    msg.textContent = "Entre ta date d'anniversaire."
    return
  }
  const limite = new Date()
  limite.setFullYear(limite.getFullYear() - 12)
  if (new Date(birthdate) > limite) {
    msg.textContent = "Tu dois avoir au moins 12 ans pour t'inscrire."
    return
  }

  const { error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { username, birthdate } }
  })

  if (error) {
    msg.textContent = 'Erreur : ' + error.message
    return
  }
  window.location.href = 'projet_fil_rouge.html'
}

// CONNEXION
async function connexion() {
  const email = document.getElementById('email').value.trim()
  const password = document.getElementById('password').value

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password })

  if (error) {
    msg.textContent = 'Email ou mot de passe incorrect.'
    return
  }
  window.location.href = 'projet_fil_rouge.html'
}