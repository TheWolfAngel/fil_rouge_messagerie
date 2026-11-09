
import { supabase } from './supabase.js';

// ========================================
// ABONNEMENTS TEMPS RÉEL
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

    // Mémoire id → nom (évite de redemander le même nom à chaque message)
    const nomsUtilisateurs = {};
    async function nomDe(id) {
        if (nomsUtilisateurs[id]) {
            return nomsUtilisateurs[id];
        }
        const { data: profil, error } = await supabase
            .from("profiles")
            .select("nom")
            .eq("id", id)
            .maybeSingle();
        if (error || !profil) {
            return "?";
        }
        nomsUtilisateurs[id] = profil.nom;
        return profil.nom;
    }

    // Clé pour se souvenir de la dernière conversation ouverte
    const cleDerniere = "derniereConversation-" + data.user.id;

    // Mettre en bleu le contact ou le salon sélectionné
    function marquerActif(bouton) {
        document.querySelectorAll(".liste-contacts button").forEach(function(b) {
            b.classList.remove("actif");
        });
        if (bouton) {
            bouton.classList.add("actif");
        }
    }

 // ========================================
 // OUVRIR UNE CONVERSATION PRIVÉE
 // ========================================
let conversationActuelle = null;
async function ouvrirConversation(utilisateur, bouton) {
    const nomContact = document.querySelector("#nom-contact");
    const listeMessages = document.querySelector("#liste-messages");
    // Afficher le nom du contact
    nomContact.textContent = "Conversation avec " + utilisateur.nom;
    marquerActif(bouton);
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
    // Se souvenir de cette conversation pour la rouvrir au prochain chargement
    localStorage.setItem(cleDerniere, JSON.stringify({
        type: "contact", id: utilisateur.id
    }));
    await chargerMessages();
    await ecouterMessages();
    await ecouterReactions();
}

 // ========================================
 // OUVRIR UN SALON PUBLIC
 // ========================================
async function ouvrirSalon(salon, bouton) {
    const nomContact = document.querySelector("#nom-contact");
    const listeMessages = document.querySelector("#liste-messages");
    nomContact.textContent = "# " + salon.nom;
    marquerActif(bouton);
    listeMessages.innerHTML = "";
    conversationActuelle = salon.id;
    localStorage.setItem(cleDerniere, JSON.stringify({
        type: "salon", id: salon.id
    }));
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
    if (messages.length === 0) {
        listeMessages.innerHTML = '<p class="vide">Aucun message. Dis bonjour 👋</p>';
        return;
    }
    for (const message of messages) {
    await afficherMessage(message);
}
    // Aller au message le plus récent
    listeMessages.scrollTop = listeMessages.scrollHeight;
}

// "14:32" aujourd'hui, sinon "28 oct. 14:32"
function formaterHeure(dateTexte) {
    const d = new Date(dateTexte);
    const heure = d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === new Date().toDateString()) {
        return heure;
    }
    return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" }) + " " + heure;
}

 // ========================================
 // AFFICHER UN MESSAGE AVEC SON EXPÉDITEUR
 // ========================================
async function afficherMessage(message) {
    const listeMessages = document.querySelector("#liste-messages");
    // Retirer le texte "Aucun message" s'il est affiché
    const vide = listeMessages.querySelector(".vide");
    if (vide) {
        vide.remove();
    }
    const estMonMessage = message.expediteur_id === data.user.id;
    const nomExpediteur = estMonMessage ? "Moi" : await nomDe(message.expediteur_id);
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
    expediteur.textContent = nomExpediteur;
    const contenu = document.createElement("p");
    contenu.className = "message";
    contenu.textContent = message.contenu;
    const heure = document.createElement("small");
    heure.className = "heure-message";
    heure.textContent = formaterHeure(message.created_at);
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
 // RÉACTIONS EMOJI
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

// Créer un bouton dans une liste (contact, utilisateur ou salon)
function creerBouton(liste, texte, action) {
    const element = document.createElement("li");
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.textContent = texte;
    bouton.addEventListener("click", function() {
        action(bouton);
    });
    element.appendChild(bouton);
    liste.appendChild(element);
    return bouton;
}

// Rouvrir automatiquement la dernière conversation ouverte (une seule fois)
let dejaRouverte = false;
function rouvrirSiDerniere(type, id, bouton, ouvrir) {
    if (dejaRouverte) {
        return;
    }
    let derniere = null;
    try {
        derniere = JSON.parse(localStorage.getItem(cleDerniere) || "null");
    } catch (e) {
        derniere = null;
    }
    if (derniere && derniere.type === type && derniere.id === id) {
        dejaRouverte = true;
        ouvrir(bouton);
    }
}

// ========================================
// MES CONTACTS (ajoutés par leur nom)
// ========================================
const listeMesContacts = document.querySelector("#liste-mes-contacts");
async function afficherMesContacts() {
    if (!listeMesContacts) {
        return;
    }
    const { data: lignes, error } = await supabase
        .from("contacts")
        .select("contact_id")
        .eq("proprietaire_id", data.user.id);
    if (error) {
        console.log("Erreur contacts :", error.message);
        listeMesContacts.innerHTML = "<li>Impossible de charger tes contacts.</li>";
        return;
    }
    if (lignes.length === 0) {
        listeMesContacts.innerHTML = "<li>Aucun contact. Ajoute quelqu'un ci-dessus.</li>";
        return;
    }
    // Récupérer les noms des contacts
    const { data: contacts, error: erreurNoms } = await supabase
        .from("profiles")
        .select("id, nom")
        .in("id", lignes.map(function(ligne) { return ligne.contact_id; }))
        .order("nom");
    if (erreurNoms) {
        console.log("Erreur contacts :", erreurNoms.message);
        listeMesContacts.innerHTML = "<li>Impossible de charger tes contacts.</li>";
        return;
    }
    listeMesContacts.innerHTML = "";
    contacts.forEach(function(contact) {
        nomsUtilisateurs[contact.id] = contact.nom;
        const ouvrir = function(b) { ouvrirConversation(contact, b); };
        const bouton = creerBouton(listeMesContacts, contact.nom, ouvrir);
        rouvrirSiDerniere("contact", contact.id, bouton, ouvrir);
    });
}

// Ajouter un contact par son nom
const formAjoutContact = document.querySelector("#form-ajout-contact");
if (formAjoutContact) {
    formAjoutContact.addEventListener("submit", async function(event) {
        event.preventDefault();
        const champAjout = document.querySelector("#champ-ajout-contact");
        const messageContact = document.querySelector("#message-contact");
        const nomCherche = champAjout.value.trim();
        if (nomCherche === "") {
            return;
        }
        // Chercher la personne par son nom (sans tenir compte des majuscules)
        const { data: trouves, error } = await supabase
            .from("profiles")
            .select("id, nom")
            .ilike("nom", nomCherche)
            .neq("id", data.user.id);
        if (error) {
            messageContact.textContent = "Erreur : " + error.message;
            return;
        }
        if (trouves.length === 0) {
            messageContact.textContent = "Utilisateur introuvable.";
            return;
        }
        if (trouves.length > 1) {
            messageContact.textContent = "Plusieurs utilisateurs portent ce nom.";
            return;
        }
        const { error: erreurAjout } = await supabase
            .from("contacts")
            .insert({ proprietaire_id: data.user.id, contact_id: trouves[0].id });
        if (erreurAjout) {
            // 23505 = déjà dans la liste
            messageContact.textContent = erreurAjout.code === "23505"
                ? trouves[0].nom + " est déjà dans tes contacts."
                : "Erreur : " + erreurAjout.message;
            return;
        }
        messageContact.textContent = trouves[0].nom + " a été ajouté ✅";
        champAjout.value = "";
        afficherMesContacts();
    });
}

// ========================================
// AFFICHER TOUS LES AUTRES UTILISATEURS
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
        nomsUtilisateurs[utilisateur.id] = utilisateur.nom;
        const ouvrir = function(b) { ouvrirConversation(utilisateur, b); };
        const bouton = creerBouton(listeContacts, utilisateur.nom, ouvrir);
        rouvrirSiDerniere("contact", utilisateur.id, bouton, ouvrir);
    });
}

// ========================================
// SALONS PUBLICS
// ========================================
const listeSalons = document.querySelector("#liste-salons");
async function afficherSalons() {
    if (!listeSalons) {
        return;
    }
    const { data: salons, error } = await supabase
        .from("conversations")
        .select("id, nom")
        .eq("est_public", true)
        .order("nom");
    if (error) {
        console.log("Erreur salons :", error.message);
        listeSalons.innerHTML = "<li>Impossible de charger les salons.</li>";
        return;
    }
    listeSalons.innerHTML = "";
    if (salons.length === 0) {
        listeSalons.innerHTML = "<li>Aucun salon. Crée le premier !</li>";
        return;
    }
    salons.forEach(function(salon) {
        const ouvrir = function(b) { ouvrirSalon(salon, b); };
        const bouton = creerBouton(listeSalons, "# " + salon.nom, ouvrir);
        rouvrirSiDerniere("salon", salon.id, bouton, ouvrir);
    });
}

// Créer un salon
const formSalon = document.querySelector("#form-salon");
if (formSalon) {
    formSalon.addEventListener("submit", async function(event) {
        event.preventDefault();
        const champSalon = document.querySelector("#champ-salon");
        const messageSalon = document.querySelector("#message-salon");
        const nomSalon = champSalon.value.trim();
        if (nomSalon === "") {
            return;
        }
        const { error } = await supabase
            .from("conversations")
            .insert({ nom: nomSalon, est_public: true, utilisateur_1: data.user.id });
        if (error) {
            // 23505 = un salon porte déjà ce nom
            messageSalon.textContent = error.code === "23505"
                ? "Ce salon existe déjà."
                : "Erreur : " + error.message;
            return;
        }
        messageSalon.textContent = "Salon « " + nomSalon + " » créé ✅";
        champSalon.value = "";
        afficherSalons();
    });
}

// Lancer le chargement
afficherMesContacts();
afficherUtilisateurs();
afficherSalons();

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
                alert("veuillez d'abord sélectionner un contact ou un salon.");
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
