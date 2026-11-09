
import { supabase } from './supabase.js';
// Récupérer l'utilisateur connecté
const { data, error } = await supabase.auth.getUser();
if (error || !data.user) {
    window.location.href = "index.html";
} else {
    const utilisateur = data.user;
    const champNom = document.querySelector("#nom");
    const champCourriel = document.querySelector("#courriel");
    const champNaissance = document.querySelector("#naissance");
    const formulaire = document.querySelector("#formulaire-profil");
    const messageProfil = document.querySelector("#message-profil");

    // Afficher les informations actuelles
    const { data: profil, error: erreurProfil } = await supabase
        .from("profiles")
        .select("nom")
        .eq("id", utilisateur.id)
        .single();
    if (erreurProfil) {
        console.log("Erreur de récupération du profil :", erreurProfil);
    } else {
        champNom.value = profil.nom;
    }
    champCourriel.value = utilisateur.email;

    // Récupérer la date de naissance enregistrée
    champNaissance.value = utilisateur.user_metadata.naissance || "";

    // Enregistrer les modifications
    formulaire.addEventListener("submit", async function(event) {
        event.preventDefault();
        const nouveauNom = champNom.value.trim();
        const nouvelleNaissance = champNaissance.value;
        if (nouveauNom === "") {
            messageProfil.textContent = "Le nom ne peut pas être vide.";
            return;
        }

        // Modifier le nom dans la table profiles
        const { error: erreurModification } = await supabase
            .from("profiles")
            .update({ nom: nouveauNom })
            .eq("id", utilisateur.id);
        if (erreurModification) {
            messageProfil.textContent = "Erreur lors de la modification du nom.";
            console.log(erreurModification);
            return;
        }

        // Modifier les informations du compte
        const { error: erreurCompte } = await supabase.auth.updateUser({
            data: {
                nom: nouveauNom,
                naissance: nouvelleNaissance
            }
        });
        if (erreurCompte) {
            messageProfil.textContent = "Le nom a été modifié, mais une erreur est survenue pour les autres informations.";
            console.log(erreurCompte);
            return;
        }
        messageProfil.textContent = "Profil modifié avec succès !";
    });

 // Déconnexion
const boutonDeconnexion = document.querySelector("#deconnexion");

if (boutonDeconnexion !== null) {

    boutonDeconnexion.addEventListener("click", async function(event) {

        event.preventDefault();

        const { error } = await supabase.auth.signOut();

        if (error) {
            console.log("Erreur de déconnexion :", error);
            return;
        }

        window.location.href = "index.html";
    });

} else {
    console.log("Le bouton de déconnexion est introuvable.");
}
}
