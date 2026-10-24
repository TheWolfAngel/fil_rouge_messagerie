
import { supabase } from './supabase.js';

// ========================================
// VÉRIFICATION DE LA CONNEXION
// ========================================
const { data, error } = await supabase.auth.getUser();
if (error || !data.user) {
    // Aucun utilisateur connecté
    window.location.href = "index.html";
} else {

    // ========================================
    // AFFICHER LE NOM DE L'UTILISATEUR
    // ========================================
    const bienvenue = document.querySelector("#bienvenue");
    const nom = data.user.user_metadata.nom;
    if (bienvenue) {
        bienvenue.textContent = "Bienvenue, " + nom + " !";
    }
   // ========================================
   // DÉCONNEXION
   // ========================================
  const boutonDeconnexion = document.querySelector("#bouton-deconnexion");
    if (boutonDeconnexion) {
    boutonDeconnexion.addEventListener("click", async function() {
        const { error } = await supabase.auth.signOut();
        if (error) {
            alert("Erreur lors de la déconnexion : " + error.message);
            return;
         }
         window.location.href = "index.html";
         });
         }    

    // ========================================
    // ENVOI DES MESSAGES
    // ========================================
    const formulaire = document.querySelector("#formulaire-message");
    const champ = document.querySelector("#champ-message");
    const listeMessages = document.querySelector("#liste-messages");
    if (formulaire && champ && listeMessages) {
        formulaire.addEventListener("submit", function(event) {
            event.preventDefault();
            const texte = champ.value.trim();
            if (texte === "") {
                return;
            }
            const bulle = document.createElement("p");
            bulle.className = "message envoye";
            bulle.textContent = texte;
            listeMessages.appendChild(bulle);
            champ.value = "";
            champ.focus();
        });
    }
}
