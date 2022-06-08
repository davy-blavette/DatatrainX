<script>


    import {onMount} from "svelte";
    import {baseUrl, dataProfil, preferenceProfil, scoreTab} from "../../service-factory/data";
    import {userIdtStore} from "../../stores";

    let jsonTrainer = [];
    let data;
    let userId;
    let Break = {};

    userIdtStore.subscribe(value => {
        userId = value;
    });
    userIdtStore.set("629ef55d5f399943f1045590");
    onMount(async () => {
        let res = await fetch(`${baseUrl}/dataProfil/${userId}`);
        jsonTrainer = [await res.json()];
        data = Object.values(jsonTrainer)[0];
        preferences();

    });

    function preferences() {

        let score = 0;
        let totalScore = 0;
        //On boucle les objects du profil dim1 récupéré sur la collection trainer
        for (const [profil, value] of Object.entries(data.dataProfil.apprenant.dim1)) {
            try {
                //on se refere au serviceFactory de preferenceProfil
                Object.entries(preferenceProfil[profil]).forEach(([type, forceValue], index) => {
                    if (value.scoreRacine >= forceValue) {
                        //on se refere au serviceFactory de scoreTab
                        dataProfil.apprenant.dim1[profil].tab = scoreTab[index].tab;
                        score = scoreTab[index].score;
                        totalScore += score;
                        //stop la boucle en levant exception
                        throw Break;
                    }
                });
            } catch (e) {
                //on ajoute au serviceFactory dataProfil les valeurs de score
                dataProfil.apprenant.dim1[profil].scoreRacine = value.scoreRacine;
                dataProfil.apprenant.dim1[profil].score = score;
            }
        }
        console.log(Object.keys(data.dataProfil.apprenant.dim1).length);
        dataProfil.apprenant.score = Math.round(totalScore / 4);
    }

</script>