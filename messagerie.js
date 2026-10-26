
import { supabase } from './supabase.js';

// ========================================
// ABONNEMENT AUX NOUVEAUX MESSAGES
// ========================================
let canalMessages = null;

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
 // OUVRIR UNE CONVERSATION
 // ========================================
let conversationActuelle = null;
async function ouvrirConversation(utilisateur) {
    const nomContact = document.querySelector("#nom-contact");
    const listeMessages = document.querySelector("#liste-messages");
    // Afficher le nom du contact
    nomContact.textContent = "Conversation avec " + utilisateur.nom;
    // Effacer les anciens messages affichés
    listeMessages.innerHTML = "";
    // Chercher une conversation existante
    const { data: conversations, error } = await supabase
        .from("conversations")
        .select("*")
        .or(
            `and(utilisateur_1.eq.${data.user.id},utilisateur_2.eq.${utilisateur.id}),and(utilisateur_1.eq.${utilisateur.id},utilisateur_2.eq.${data.user.id})`
        );
    if (error) {
        console.log("Erreur :", error.message);
        nomContact.textContent = "Impossible d'ouvrir la conversation.";
        return;
    }
    // Vérifier si une conversation existe
    if (conversations.length > 0) {
        conversationActuelle = conversations[0].id;
        console.log("Conversation retrouvée :", conversationActuelle);
    } else {
        // Créer une nouvelle conversation
        const { data: nouvelleConversation, error: erreurCreation } =
            await supabase
                .from("conversations")
                .insert({
                    utilisateur_1: data.user.id,
                    utilisateur_2: utilisateur.id
                })
                .select()
                .single();
        if (erreurCreation) {
            console.log("Erreur de création :", erreurCreation.message);
            nomContact.textContent = "Impossible de créer la conversation.";
            return;
        }
        conversationActuelle = nouvelleConversation.id;
        console.log("Nouvelle conversation créée :", conversationActuelle);
    }
    await chargerMessages();
    await ecouterMessages();
}


 // ========================================
 // CHARGER LES MESSAGES
 // ========================================
async function chargerMessages() {
    const listeMessages = document.querySelector("#liste-messages");
    if (!conversationActuelle || !listeMessages) {
        return;
    }

    // Récupérer les messages de la conversation
    const { data: messages, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationActuelle)
        .order("created_at", { ascending: true });
    if (error) {
        console.log("Erreur de chargement :", error.message);
        return;
    }

    // Vider la liste
    listeMessages.innerHTML = "";

    // Afficher les messages
    messages.forEach(function(message) {
        const bulle = document.createElement("p");
        bulle.className = "message";
        if (message.expediteur_id === data.user.id) {
            bulle.classList.add("envoye");
        } else {
            bulle.classList.add("recu");
        }
        bulle.textContent = message.contenu;
        listeMessages.appendChild(bulle);
    });
}


 // ========================================
 // RECEVOIR LES MESSAGES EN TEMPS RÉEL
 // ========================================
async function ecouterMessages() {
    // Supprimer l'ancien abonnement
    if (canalMessages !== null) {
        await supabase.removeChannel(canalMessages);
        canalMessages = null;
    }
    if (!conversationActuelle) {
        return;
    }
    // Créer un nouvel abonnement
    canalMessages = supabase
        .channel("messages-" + conversationActuelle)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "messages",
                filter: "conversation_id=eq." + conversationActuelle
            },
            function(payload) {
                const message = payload.new;
                const listeMessages =
                    document.querySelector("#liste-messages");
                const bulle = document.createElement("p");
                bulle.className = "message";
                if (message.expediteur_id === data.user.id) {
                    bulle.classList.add("envoye");
                } else {
                    bulle.classList.add("recu");
                }
                bulle.textContent = message.contenu;
                listeMessages.appendChild(bulle);
            }
        )
        .subscribe();
}


// ========================================
// AFFICHER LES AUTRES UTILISATEURS
// ========================================
const listeContacts = document.querySelector("#liste-contacts");
async function afficherUtilisateurs() {
    if (!listeContacts) {
        return;
    }
    // Récupérer les profils dans Supabase
    const { data: utilisateurs, error } = await supabase
        .from("profiles")
        .select("id, nom")
        .neq("id", data.user.id)
        .order("nom");
    if (error) {
        console.log("Erreur :", error.message);
        listeContacts.textContent = "Impossible de charger les utilisateurs.";
        return;
    }
    // Vider la liste actuelle
    listeContacts.innerHTML = "";
    if (utilisateurs.length === 0) {
        listeContacts.textContent = "Aucun autre utilisateur inscrit.";
        return;
    }
    // Afficher chaque utilisateur
    utilisateurs.forEach(function(utilisateur) {
        const element = document.createElement("li");
        const bouton = document.createElement("button");
        bouton.textContent = utilisateur.nom;
        bouton.addEventListener("click", function() {
           ouvrirConversation(utilisateur);
        });
        element.appendChild(bouton);
        listeContacts.appendChild(element);
    });
}
// Lancer le chargement
afficherUtilisateurs();

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
    
    if (formulaire && champ) {
        formulaire.addEventListener("submit", async function(event) {
            event.preventDefault();
            const texte = champ.value.trim();
            if (texte === "") {
                return;
            }
            if(!conversationActuelle){
                alert("veuillez d'abord sélectionner un contact.");
                return;
            }
            //message enregistrer
            const{error}= await supabase
            .from("messages")
            .insert({
                conversation_id:conversationActuelle,
                expediteur_id:data.user.id,
                contenu: texte
            });
            if(error){
                alert("Erreur lors de l'envoi:"+error.message);
                console.log(error);
                return;
            }
            //vider le champ
            champ.value="";
            champ.focus();
        });
    }
}
