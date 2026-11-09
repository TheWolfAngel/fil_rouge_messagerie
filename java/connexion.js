
import { supabase } from './supabase.js';
// ========================================
// CRÉATION D'UN COMPTE
// ========================================
const formulaire = document.querySelector("#formulaire-connexion");
formulaire.addEventListener("submit", async function(event) {
    event.preventDefault();
    const courriel = document.querySelector("#courriel").value;
    const motDePasse = document.querySelector("#pwd").value;
    const nom = document.querySelector("#nom").value;
    const naissance = document.querySelector("#naissance").value;
    if (nom === "" || naissance === "") {
        alert("Veuillez remplir votre nom et votre date de naissance.");
        return;
    }
    const { error } = await supabase.auth.signUp({
        email: courriel,
        password: motDePasse,
        options: {
            data: {
                nom: nom,
                naissance: naissance
            }
        }
    });
    if (error) {
        alert("Erreur : " + error.message);
        return;
    }
    alert("Compte créé ! Vérifiez votre adresse courriel.");
});

// ========================================
// CONNEXION À UN COMPTE
// ========================================
const boutonConnexion = document.querySelector("#bouton-connexion");
boutonConnexion.addEventListener("click", async function() {
    const courriel = document.querySelector("#courriel").value;
    const motDePasse = document.querySelector("#pwd").value;
    if (courriel === "" || motDePasse === "") {
        alert("Veuillez entrer votre courriel et votre mot de passe.");
        return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({
        email: courriel,
        password: motDePasse
    });
    if (error) {
        alert("Erreur de connexion : " + error.message);
        return;
    }
    alert("Connexion réussie !");
    window.location.href = "projet_fil_rouge.html";
});