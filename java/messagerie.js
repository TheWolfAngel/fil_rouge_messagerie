
import { supabase } from './supabase.js';

// ========================================
// ABONNEMENT AUX NOUVEAUX MESSAGES
// ========================================
let canalReactions = null;
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
    await ecouterReactions();
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
    listeMessages.innerHTML="";
    for (const message of messages) {
    await afficherMessage(message);
}
    // Aller au message le plus récent
    listeMessages.scrollTop = listeMessages.scrollHeight;
}

 // ========================================
 // AFFICHER UN MESSAGE AVEC SON EXPÉDITEUR
 // ========================================
async function afficherMessage(message) {
    const listeMessages = document.querySelector("#liste-messages");
    const estMonMessage = message.expediteur_id === data.user.id;
    const { data: profil, error } = await supabase
        .from("profiles")
        .select("nom")
        .eq("id", message.expediteur_id)
        .single();
    if (error) {
        console.log("Erreur de récupération du profil :", error.message);
        return;
    }
    const conteneur = document.createElement("div");
    conteneur.className = "conteneur-message";
    conteneur.dataset.messageId = message.id;
    if (estMonMessage) {
        conteneur.classList.add("message-envoye");
    } else {
        conteneur.classList.add("message-recu");
    }
    const expediteur = document.createElement("p");
    expediteur.className = "nom-expediteur";
    if (estMonMessage) {
        expediteur.textContent = "Moi";
    } else {
        expediteur.textContent = profil.nom;
    }
    const contenu = document.createElement("p");
    contenu.className = "message";
    contenu.textContent = message.contenu;
    const heure = document.createElement("small");
    heure.className = "heure-message";
    const dateMessage = new Date(message.created_at);
    heure.textContent = dateMessage.toLocaleString("fr-CA", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
    //zone des reactions
    const zoneReactions= document.createElement("div");
    zoneReactions.className="zone-reactions";

    conteneur.appendChild(expediteur);
    conteneur.appendChild(contenu);
    conteneur.appendChild(heure);
    conteneur.appendChild(zoneReactions);
    listeMessages.appendChild(conteneur);
    //changer reaction
    await afficherReactions(message, zoneReactions);
    //defillement de conversation
    listeMessages.scrollTop = listeMessages.scrollHeight;
}

 // ========================================
 // RECEVOIR LES MESSAGES EN TEMPS RÉEL
 // ========================================
 
async function afficherReactions(message, zoneReactions) {
    const emojis = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
    const { data: reactions, error } = await supabase
        .from("reactions")
        .select("id, utilisateur_id, emoji")
        .eq("message_id", message.id);
    if (error) {
        console.log("Erreur de chargement des réactions :", error);
        return;
    }
    zoneReactions.innerHTML = "";
    emojis.forEach(function(emoji) {
        // Compter les réactions utilisant cet emoji
        const nombre = reactions.filter(function(reaction) {
            return reaction.emoji === emoji;
        }).length;
        // Vérifier si l'utilisateur actuel a réagi
        const maReaction = reactions.find(function(reaction) {
            return reaction.utilisateur_id === data.user.id
                && reaction.emoji === emoji;
        });
        const bouton = document.createElement("button");
        bouton.type = "button";
        bouton.className = "bouton-reaction";
        bouton.textContent = emoji;
        if (nombre > 0) {
            bouton.textContent += " " + nombre;
        }
        if (maReaction) {
            bouton.classList.add("reaction-active");
        }
        // Ajouter ou retirer une réaction
        bouton.addEventListener("click", async function() {
            const { data: reactionExistante, error: erreurRecherche } =
                await supabase
                    .from("reactions")
                    .select("id, emoji")
                    .eq("message_id", message.id)
                    .eq("utilisateur_id", data.user.id)
                    .maybeSingle();
            if (erreurRecherche) {
                console.log("Erreur de recherche :", erreurRecherche);
                return;
            }
            // Si la même réaction existe, la retirer
            if (reactionExistante && reactionExistante.emoji === emoji) {
                const { error } = await supabase
                    .from("reactions")
                    .delete()
                    .eq("id", reactionExistante.id);
                if (error) {
                    console.log("Erreur de suppression :", error);
                    return;
                }
            } else {
                // Retirer l'ancienne réaction si nécessaire
                if (reactionExistante) {
                    const { error } = await supabase
                        .from("reactions")
                        .delete()
                        .eq("id", reactionExistante.id);
                    if (error) {
                        console.log("Erreur de suppression :", error);
                        return;
                    }
                }
                // Enregistrer la nouvelle réaction
                const { error } = await supabase
                    .from("reactions")
                    .insert({
                        message_id: message.id,
                        utilisateur_id: data.user.id,
                        emoji: emoji
                    });
                if (error) {
                    console.log("Erreur d'ajout :", error);
                    return;
                }
            }
            // Actualiser les réactions affichées
            await afficherReactions(message, zoneReactions);
        });
        zoneReactions.appendChild(bouton);
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
            async function(payload) {
                const message = payload.new;
                await afficherMessage(message);
            }
        )
        .subscribe();
}

async function ecouterReactions() {
    // Arrêter l'ancienne écoute si nécessaire
    if (canalReactions !== null) {
        await supabase.removeChannel(canalReactions);
        canalReactions = null;
    }
    // Écouter les changements dans la table reactions
    canalReactions = supabase
        .channel("reactions-en-temps-reel")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "reactions"
            },
            async function(payload) {
                // Récupérer l'identifiant du message concerné
                let messageId;
                if (payload.eventType === "DELETE") {
                    messageId = payload.old.message_id;
                } else {
                    messageId = payload.new.message_id;
                }
                // Chercher le message dans la conversation affichée
                const conteneur = document.querySelector(
                    `[data-message-id="${messageId}"]`
                );
                // Ne rien faire si le message n'est pas affiché
                if (!conteneur) return;
                const zoneReactions = conteneur.querySelector(
                    ".zone-reactions"
                );
                // Récupérer le message depuis Supabase
                const { data: message, error } = await supabase
                    .from("messages")
                    .select("*")
                    .eq("id", messageId)
                    .maybeSingle();
                if (error) {
                    console.log("Erreur de récupération du message :", error);
                    return;
                }
                if (message && zoneReactions) {
                    await afficherReactions(message, zoneReactions);
                }
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
