<script>
    import {updatePush} from "../../service-factory/update";
    import {
        baseUrl,
        chartExpressions,
        dataProfil, kolbProfil, preferenceProfil,
        resultatExpressions, scoreTab,
        streamExpression
    } from "../../service-factory/data";
    import {infoLoadStore, layoutStore, userIdtStore} from "../../stores";
    import {onMount} from "svelte";
    import Loading from "../utils/Loading.svelte";
    import LogoHead from "../layout/LogoHead.svelte";

    infoLoadStore.set("Calcul des resultats...");

    let jsonTrainer = [];
    let data;
    let userId;
    let Break = {};

    userIdtStore.subscribe(value => {
        userId = value;
    });

    function updateProfil() {

        //userIdtStore.set("629de5a2f270c4e2011ba0c1");
        onMount(async () => {
            let res = await fetch(`${baseUrl}/dataProfil/${userId}`);
            jsonTrainer = [await res.json()];
            data = Object.values(jsonTrainer)[0];
            preferences();
            scoreProfil();
            profile();
            emotions();
            await updatePush('dataProfil', {
                apprenant: dataProfil.apprenant,
                expressions: dataProfil.expressions,
                created: Date.now()
            });
        });
    }


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
        //score global
        dataProfil.apprenant.score = Math.round(totalScore / Object.keys(data.dataProfil.apprenant.dim1).length);

    }

    function profile() {
        let bestProfil = "";
        let bestScore = 0;
        for (const [profil, score] of Object.entries(dataProfil.apprenant.dim2)) {
            if (score > bestScore) {
                bestProfil = profil.toUpperCase();
                bestScore = score;
            } else if (score == bestScore) {
                bestProfil += "/" + profil.toUpperCase();
            }
        }
        dataProfil.apprenant.profil = bestProfil;

    }

    function scoreProfil() {
        let score = 0;
        for (const [profil, array] of Object.entries(kolbProfil)) {
            score = dataProfil.apprenant.dim1[array[0]].score + dataProfil.apprenant.dim1[array[1]].score;
            dataProfil.apprenant.dim2[profil] = Math.trunc(score / 2);
        }
    }

    function emotions() {

        let counter = 0;
        let totalCounter = 0;
        //clean value
        for (const [expression, value] of Object.entries(chartExpressions)) {
            streamExpression[expression].length = 0;
        }

        //boucle sur les expressions streaming de la collection trainer
        data.dataExpression.forEach(function (expressions) {
            //boucle sur le panel d'expression de la collection trainer
            for (const [expression, value] of Object.entries(expressions.FaceExpression)) {
                //on ne souhaite pas faire de statistiques sur l'expression neutre
                if (value > 0 && expression != 'neutre') {
                    //on ajoute au serviceFactory de dataProfil
                    resultatExpressions[expression].count += 1;
                    resultatExpressions[expression].total += value;
                    if (resultatExpressions[expression].best < value) {
                        resultatExpressions[expression].best = value;
                        resultatExpressions[expression].image = expressions.FaceDetection.image;
                        resultatExpressions[expression].key = counter;
                    }
                    //serviceFactory temporaire utiliser juste pour l'affichage des resultats
                    streamExpression[expression].push({
                        x: expressions.created,
                        y: value,
                    });
                    counter++;
                }
                ;
                totalCounter++;
            }
        });
        //ratio
        for (const [expression, value] of Object.entries(resultatExpressions)) {
            resultatExpressions[expression].ratio = Math.round(resultatExpressions[expression].count / counter * 100);
        };
        dataProfil.expressions.resultatExpressions = resultatExpressions;
        dataProfil.expressions.score = Math.round(counter / totalCounter * 100);
    }

    updateProfil();

</script>
<section class="container has-text-centered">
    {#if jsonTrainer.length === 0}
        <Loading />
    {:else}
        <div class="tile">
            <LogoHead/>
        </div>
        <div class="subtitle">
            <button class="button are-medium center is-success is-rounded" on:click ={() => layoutStore.setLayout("resultatKolb")}>
                <span class="icon">
                    <i class="fa-solid fa-check"></i>
                </span>
                <span>Voir les résultats</span>
            </button>
        </div>
    {/if}
</section>