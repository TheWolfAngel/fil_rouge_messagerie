let moi = null              //l'utilisateur connecte 
let contactActif = null     //le contact selectionné


//Au demarrage : verifier la connexion, puis charger les contacts
async function demarrer (){
    const { data : { session} } = await supabaseClient.auth.getSession()
    if (!session){
        window.location.href = 'index.html'
        return
    }
    moi = session.user
    chargerContacts()
}


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

  // Trier par username puis afficher
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
    })
}

// Ajouter un contact par son username
document.getElementById('form-ajout-contact').addEventListener('submit', async (event) => {
  event.preventDefault()
  const champ = document.getElementById('champ-ajout-contact')
  const message = document.getElementById('message-contact')
  const username = champ.value.trim()
  if (username === '') return

  const { data, error } = await supabaseClient.rpc('add_contact', { p_username: username })

  if (error) {
    message.textContent = error.message   // ex. "Utilisateur introuvable"
    return
  }

  message.textContent = data.username + ' a été ajouté ✅'
  champ.value = ''
  chargerContacts()   // rafraîchir la liste
})

//Quand on clique sur un contact
function choisirContact(user, bouton){
    contactActif = user
    document.getElementById('titre-conversation').textContent = 'Conversation avec ' + user.username

    document.querySelectorAll('.liste-contacts button').forEach((b) => b.classList.remove('actif'))
    bouton.classList.add('actif')
}


const formulaire = document.querySelector("#formulaire-message");
const champ = document.querySelector("#champ-message");
const listeMessages = document.querySelector("#liste-messages");


formulaire.addEventListener("submit", function(event){
    event.preventDefault();

    const texte = champ.value.trim();

    if(texte === ""){
        return;
    }

    const bulle = document.createElement("p");
    bulle.className = "message envoye";
    bulle.textContent = texte;


    listeMessages.appendChild(bulle);

    champ.value = "";
    champ.focus();
    
    demarrer()
});