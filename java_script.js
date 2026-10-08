console.log("Bonjour");
console.log(2+3);

const courriel= 
  document.querySelector("#courriel");

console.log(courriel.value);

courriel.addEventListener("input",function(event){
    console.log(event.target.value);
    const valeur = courriel.value;

    const estVide=valeur==="";
    const unArobase=valeur.includes("@");

    console.log("courriel:",valeur);
    if(valeur===""){
        courrielMessage.textContent= "Le courriel est obligatoire.";
    }
   
    else if(!unArobase){
        courrielMessage.textContent="le courriel n'est pas valide";
    }
    else{
        courrielMessage.textContent="tout semble valide";
    }

});

