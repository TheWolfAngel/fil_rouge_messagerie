// ===============================
// VARIABLES
// ===============================
let moi = null                  // l'utilisateur connecté
let contactActif = null         // le contact sélectionné
let conversationActive = null   // id de la conversation ouverte
let estUnSalon = false          // true si la conversation ouverte est un salon public
let canal = null                // connexion temps réel
const nomsUtilisateurs = {}     // mémoire id → username (pour afficher l'auteur)

// Éléments de la page
const formulaire = document.querySelector('#formulaire-message')
const champ = document.querySelector('#champ-message')
const listeMessages = document.querySelector('#liste-messages')


// ===============================
// DÉMARRAGE
// ===============================
async function demarrer() {
  const { data: { session } } = await supabaseClient.auth.getSession()
  if (!session) {
    window.location.href = 'index.html'   // pas connecté → retour à la connexion
    return
  }
  moi = session.user
  chargerContacts()
  chargerSalons()
}


// ===============================
// CONTACTS
// ===============================
// Charger MA liste de contacts (seulement le username)
async function chargerContacts() {
  const liste = document.getElementById('liste-contacts')

  const { data, error } = await supabaseClient
    .from('contacts')
    .select('profiles(id, username)')

  if (error) {
    liste.innerHTML = '<li>Erreur de chargement</li>'
    console.error(error)
    return
  }

  liste.innerHTML = ''
  if (data.length === 0) {
    liste.innerHTML = '<li>Aucun contact. Ajoute quelqu\'un ci-dessus.</li>'
    return
  }

  let aRouvrir = null   // dernier contact ouvert (s'il existe)

  data
    .map((ligne) => ligne.profiles)
    .sort((a, b) => a.username.localeCompare(b.username))
    .forEach((user) => {
      const li = document.createElement('li')
      const bouton = document.createElement('button')
      bouton.type = 'button'
      bouton.textContent = user.username
      bouton.addEventListener('click', () => choisirContact(user, bouton))
      li.appendChild(bouton)
      liste.appendChild(li)

      if (user.id === localStorage.getItem('dernierContact-' + moi.id)) {
        aRouvrir = { user, bouton }
      }
    })

  // Rouvrir automatiquement la dernière conversation
  if (aRouvrir) choisirContact(aRouvrir.user, aRouvrir.bouton)
}

// Ajouter un contact par son username
document.getElementById('form-ajout-contact').addEventListener('submit', async (event) => {
  event.preventDefault()
  const champAjout = document.getElementById('champ-ajout-contact')
  const message = document.getElementById('message-contact')
  const username = champAjout.value.trim()
  if (username === '') return

  const { data, error } = await supabaseClient.rpc('add_contact', { p_username: username })

  if (error) {
    message.textContent = error.message   // ex. "Utilisateur introuvable"
    return
  }

  message.textContent = data.username + ' a été ajouté ✅'
  champAjout.value = ''
  chargerContacts()
})

// Clic sur un contact → conversation privée
async function choisirContact(user, bouton) {
  contactActif = user

  const { data: convId, error } = await supabaseClient.rpc('start_conversation', { other_user: user.id })
  if (error) {
    console.error(error)
    listeMessages.innerHTML = '<p>Impossible d\'ouvrir la conversation.</p>'
    return
  }

  localStorage.setItem('dernierContact-' + moi.id, user.id)   // mémoriser
  estUnSalon = false
  ouvrirConversation(convId, 'Conversation avec ' + user.username, bouton)
}


// ===============================
// SALONS PUBLICS
// ===============================
// Charger la liste des salons publics
async function chargerSalons() {
  const liste = document.getElementById('liste-salons')

  const { data, error } = await supabaseClient
    .from('conversations')
    .select('id, name')
    .eq('is_public', true)
    .order('name')

  if (error) {
    liste.innerHTML = '<li>Erreur de chargement</li>'
    console.error(error)
    return
  }

  liste.innerHTML = ''
  if (data.length === 0) {
    liste.innerHTML = '<li>Aucun salon. Crée le premier !</li>'
    return
  }

  data.forEach((salon) => {
    const li = document.createElement('li')
    const bouton = document.createElement('button')
    bouton.type = 'button'
    bouton.textContent = '# ' + salon.name
    bouton.addEventListener('click', () => ouvrirSalon(salon, bouton))
    li.appendChild(bouton)
    liste.appendChild(li)
  })
}

// Créer un salon
document.getElementById('form-salon').addEventListener('submit', async (event) => {
  event.preventDefault()
  const champSalon = document.getElementById('champ-salon')
  const message = document.getElementById('message-salon')
  const nom = champSalon.value.trim()
  if (nom === '') return

  const { error } = await supabaseClient.rpc('create_room', { p_name: nom })

  if (error) {
    message.textContent = error.message   // ex. "Ce salon existe déjà"
    return
  }

  message.textContent = 'Salon « ' + nom + ' » créé ✅'
  champSalon.value = ''
  chargerSalons()
})

// Clic sur un salon → le rejoindre puis l'ouvrir
async function ouvrirSalon(salon, bouton) {
  const { error } = await supabaseClient.rpc('join_room', { p_conv: salon.id })
  if (error) {
    console.error(error)
    listeMessages.innerHTML = '<p>Impossible de rejoindre ce salon.</p>'
    return
  }

  contactActif = null
  estUnSalon = true
  ouvrirConversation(salon.id, '# ' + salon.name, bouton)
}


// ===============================
// CONVERSATION (privée ou salon)
// ===============================
async function ouvrirConversation(convId, titre, bouton) {
  conversationActive = convId
  document.getElementById('titre-conversation').textContent = titre

  // Mettre en bleu le contact ou salon sélectionné
  document.querySelectorAll('.liste-contacts button').forEach((b) => b.classList.remove('actif'))
  bouton.classList.add('actif')

  await chargerMessages()
  ecouterMessages()
  champ.focus()
}

// Charger l'historique des messages
async function chargerMessages() {
  listeMessages.innerHTML = ''

  const { data, error } = await supabaseClient
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationActive)
    .order('created_at')

  if (error) {
    console.error(error)
    return
  }
  if (data.length === 0) {
    listeMessages.innerHTML = '<p class="vide">Aucun message. Dis bonjour 👋</p>'
    return
  }

  await chargerNoms(data.map((m) => m.sender_id))   // récupérer les usernames d'un coup
  data.forEach(afficherMessage)
}

// Récupérer les usernames qu'on ne connaît pas encore
async function chargerNoms(ids) {
  const inconnus = [...new Set(ids)].filter((id) => !nomsUtilisateurs[id])
  if (inconnus.length === 0) return

  const { data } = await supabaseClient
    .from('profiles')
    .select('id, username')
    .in('id', inconnus)

  ;(data || []).forEach((p) => { nomsUtilisateurs[p.id] = p.username })
}


// ===============================
// MESSAGES
// ===============================
// Afficher une bulle de message avec l'heure (et l'auteur dans un salon)
function afficherMessage(msg) {
  const vide = listeMessages.querySelector('.vide')
  if (vide) vide.remove()

  const estMoi = msg.sender_id === moi.id
  const bulle = document.createElement('div')
  bulle.className = 'message ' + (estMoi ? 'envoye' : 'recu')

  // Dans un salon, afficher qui a écrit
  if (estUnSalon && !estMoi) {
    const auteur = document.createElement('small')
    auteur.className = 'auteur'
    auteur.textContent = nomsUtilisateurs[msg.sender_id] || '?'
    bulle.appendChild(auteur)
  }

  const texte = document.createElement('span')
  texte.textContent = msg.content

  const heure = document.createElement('small')
  heure.className = 'heure'
  heure.textContent = formaterHeure(msg.created_at)

  bulle.append(texte, heure)
  listeMessages.appendChild(bulle)
  listeMessages.scrollTop = listeMessages.scrollHeight   // descendre en bas
}

// "14:32" aujourd'hui, sinon "28 oct. 14:32"
function formaterHeure(dateTexte) {
  const d = new Date(dateTexte)
  const heure = d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === new Date().toDateString()) return heure
  return d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }) + ' ' + heure
}

// Recevoir les nouveaux messages en temps réel
function ecouterMessages() {
  if (canal) supabaseClient.removeChannel(canal)   // fermer l'ancienne conversation

  canal = supabaseClient
    .channel('conv-' + conversationActive)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: 'conversation_id=eq.' + conversationActive
      },
      async (payload) => {
        await chargerNoms([payload.new.sender_id])
        afficherMessage(payload.new)
      }
    )
    .subscribe()
}

// Envoyer un message
formulaire.addEventListener('submit', async (event) => {
  event.preventDefault()
  const texte = champ.value.trim()
  if (texte === '' || !conversationActive) return

  champ.value = ''
  const { error } = await supabaseClient
    .from('messages')
    .insert({ conversation_id: conversationActive, content: texte })

  if (error) {
    console.error(error)
    champ.value = texte   // on remet le texte si l'envoi a échoué
  }
  // Le temps réel renvoie le message à tout le monde, y compris à moi
})


// ===============================
// LANCEMENT
// ===============================
demarrer()