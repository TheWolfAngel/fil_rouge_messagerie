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
});