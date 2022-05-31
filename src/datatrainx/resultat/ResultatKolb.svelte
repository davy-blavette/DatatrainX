<script>

    import {baseUrl, dataExpression, kolbReponse} from "../../database/data";
    import {userIdtStore} from "../../stores";
    import ChartKolb from "./ChartKolb.svelte";
    import RadarKolb from "./RadarKolb.svelte";
    import TableKolb from "./TableKolb.svelte";

    let userId;
    let c1 = 0;
    let c2 = 0;
    let c3 = 0;
    let c4 = 0;
    let dimension1 = 0;
    let dimension2 = 0;
    let profil = "";
    let method = "PUT";
    let reponse = kolbReponse;
    let kolbReponseDefault = ["B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B"];

    if(kolbReponse.length == 0){
        reponse = ["B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B"];
    }

    for (let i = 0; i < reponse.length; i++) {
        if (i%2 == 0) {
            if (i < 12) {
                if(reponse[i] == "A"){
                    c1++;
                }
            } else {
                if(reponse[i] == "B"){
                    c3++;
                }
            }
        } else{
            if (i < 12) {
                if(reponse[i] == "B"){
                    c2++;
                }
            } else {
                if(reponse[i] == "A"){
                    c4++;
                }
            }
        }

        //console.log(`${i}${i%2}-${reponse[i]} c1 ${c1} c2 ${c2} c3 ${c3} c4 ${c4}`);
    }

    dimension1 = c1 + c2;
    dimension2 = c3 + c4;

    if(dimension1 <= 6 && dimension2 >= 6){
        profil += "ADAPTATEUR";
    }
    if(dimension1 >= 6 && dimension2 >= 6){
        if(profil.length){
            profil += " - ";
        }
        profil += "DIVERGEUR";
    }
    if(dimension1 >= 6 && dimension2 <= 6){
        if(profil.length){
            profil += " - ";
        }
        profil += "ASSIMILATEUR";
    }
    if (dimension1 <= 6 && dimension2 <= 6){
        if(profil.length){
            profil += " - ";
        }
        profil = "CONVERGEUR";
    }


    userIdtStore.subscribe(value => {
        userId = value;
    });

    let updateKolb = async () => {

        URL = `${baseUrl}/kolb/${userId}`;

        let data = {
            kolb: {
                dataExpression,
                reponse:kolbReponse,
                resultat: {
                    profil:profil,
                    dimension1:dimension1,
                    dimension2:dimension2
                }
            }
        };

        const res = await fetch(URL, {
            method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
        const trainer = res.json();

    };

    if(kolbReponse.length > 0) {
        updateKolb();
    }

</script>
<style></style>


<div class="columns is-multiline columns is-multiline has-background-light">
    <div class="column is-half">
        <div class="tile">
            <article class="tile is-child is-info">
                <p class="title">Votre profil d'apprenant</p>
                <p class="">A travers la saisie d’un questionnaire (Kolb) nous cherchons à déterminer un profil d’apprenant dans le projet DataTrainx.<br>L’utilisateur sera enregistré en vidéo et une comparaison sera effectuée avec les émotions que vous aurez exprimées.</p>
                <div class="tile is-parent">
                    <TableKolb/>
                </div>
                <div class="buttons are-medium notification">
                    <button class="button are-medium center is-link is-rounded">
                        <span class="icon">
                            <i class="fa-solid fa-print"></i>
                        </span>
                        <span>Imprimer</span>
                    </button>
                </div>
            </article>
        </div>
    </div>
    <div class="column is-half">
        <div class="tile is-parent">
            <RadarKolb/>
        </div>
    </div>
    <div class="column is-half">
        <div class="tile is-parent">
            <ChartKolb/>
        </div>
    </div>
    <div class="column is-half">
        <div class="tile is-parent">
            <ChartKolb/>
        </div>
    </div>
</div>
