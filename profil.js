// PAGE PROFIL : CHANGER DE USERNAME 

const { SupabaseClient } = require("@supabase/supabase-js/dist/index.cjs")

let moi = null
const affichage = document.getElementById('username-actuel')
const message = document.getElementById('message-profil')


// Verifier la connexion et afficher le username actuel
async function demarrer() {
    const { data: { session }  } = await SupabaseClient.auth.getSession()
    if (!session) {
        window.location.href = 'index.html'
        return
    }
    moi = session.user

    const { data, error } = await SupabaseClient
        .from('profiles')
        .select('username')
        .eq('id', moi.id)
        .single()
    affichage.textContent = error ? '(erreur)' : data.username

}

//Changer le username
document.getElementById('form-username').addEventListener('submit', async (event) => {
    event.preventDefault()
    const nouveau = document.getElementById('nouveau-username').value.trim()
    
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(nouveau)) {
    message.textContent = 'Username : 3 à 20 caractères, lettres, chiffres ou _ seulement.'
        return
    }

    const { error } =  await SupabaseClient
        .from('profiles')
        .update({ username: nouveau })
        .eq('id', moi.id)
    
    if (error) {
        message.textContent = error.code ==='23505'
        ? 'Ce username est deja pris.'
        : 'Erreur : '+error.message
        return
    }
    affichage.textContent = nouveau
    message.textContent = 'Username modifié'
    document.getElementById('nouveau-username').value = ''

})

demarrer()