<script>
    import {onMount} from "svelte";
    import {infoLoadStore, layoutTrainxStore, loadingStore, userIdtStore} from "../../stores";
    import RadarKolb from "./RadarKolb.svelte";
    import {baseUrl, streamExpression} from "../../service-factory/data";
    import Loading from "../utils/Loading.svelte";
    import BarKolb from "./BarKolb.svelte";
    import SimpleAdaptateur from "./profil/SimpleAdaptateur.svelte";
    import Adaptateur from "./profil/Adaptateur.svelte";
    import Divergeur from "./profil/Divergeur.svelte";
    import Assimilateur from "./profil/Assimilateur.svelte";
    import Convergeur from "./profil/Convergeur.svelte";
    import SimpleDivergeur from "./profil/SimpleDivergeur.svelte";
    import SimpleAssimilateur from "./profil/SimpleAssimilateur.svelte";
    import SimpleConvergeur from "./profil/SimpleConvergeur.svelte";
    import Accordion from "../utils/Accordion.svelte";
    import Vignettes from "./profil/Vignettes.svelte";
    import StreamKolb from "./StreamKolb.svelte";

    //fin enregistrement
    layoutTrainxStore.setLayout("");
    let userId;
    let jsonTrainer = [];
    let loading;
    let data;
    let profil;
    let score;
    let tabActivist;
    let tabReflector;
    let tabTheorist;
    let tabPragmatist;
    let scoreDivergeur;
    let scoreAdaptateur;
    let scoreConvergeur;
    let scoreAssimilateur;
    let colere = {count: 0, best: 0, total: 0, image: "", key: 0};
    let degout = {count: 0, best: 0, total: 0, image: "", key: 0};
    let peur = {count: 0, best: 0, total: 0, image: "", key: 0};
    let joie = {count: 0, best: 0, total: 0, image: "", key: 0};
    let triste = {count: 0, best: 0, total: 0, image: "", key: 0};
    let surprise = {count: 0, best: 0, total: 0, image: "", key: 0};
    let neutre = {count: 0, best: 0, total: 0, image: "", key: 0};

    userIdtStore.subscribe(value => {
        userId = value;
    });

    loadingStore.subscribe(value => {
        loading = value;
    });

    infoLoadStore.set("Chargement Resultats...");

    if (!userId) {
        userId = "629b669f2c45b705d0942ff7";
    }
    onMount(async () => {
        let res = await fetch(`${baseUrl}/dataProfil/${userId}`);
        jsonTrainer = [await res.json()];
        data = Object.values(jsonTrainer)[0];
        profile();
        preferences();
        scoreProfil();
        emotions();
    });

    function profile() {
        if (data.dataProfil.activist > data.dataProfil.theorist) {
            if (data.dataProfil.reflector > data.dataProfil.pragmatist) {
                profil = "DIVERGEUR";
                scoreDivergeur = 0;
            } else {
                profil = "ADAPTATEUR";
                scoreAdaptateur = 0;
            }
        } else {
            if (data.dataProfil.reflector > data.dataProfil.pragmatist) {
                profil = "ASSIMILATEUR";
                scoreAssimilateur = 0;
            } else {
                profil = "CONVERGEUR";
                scoreConvergeur = 2;
            }

        }
    }

    function scoreProfil() {

        //Adaptateur
        if (tabActivist[1] > 40) {
            if (tabPragmatist[1] > 40) {
                scoreAdaptateur = 5;
            } else if (tabPragmatist[1] > 20) {
                scoreAdaptateur = 4;
            } else {
                scoreAdaptateur = 3;
            }
        } else if (tabActivist[1] > 20) {
            if (tabPragmatist[1] > 40) {
                scoreAdaptateur = 4;
            } else if (tabPragmatist[1] > 20) {
                scoreAdaptateur = 3;
            } else {
                scoreAdaptateur = 2;
            }
        } else if (tabActivist[1] > -40) {
            if (tabPragmatist[1] > 40) {
                scoreAdaptateur = 4;
            } else if (tabPragmatist[1] > -40) {
                scoreAdaptateur = 3;
            } else {
                scoreAdaptateur = 2;
            }
        } else {
            if (tabPragmatist[1] > 40) {
                scoreAdaptateur = 3;
            } else if (tabPragmatist[1] > 20) {
                scoreAdaptateur = 2;
            } else {
                scoreAdaptateur = 1;
            }
        }

        //Convergeur
        if (tabPragmatist[1] > 40) {
            if (tabTheorist[1] > 40) {
                scoreConvergeur = 5;
            } else if (tabTheorist[1] > 20) {
                scoreConvergeur = 4;
            } else {
                scoreConvergeur = 3;
            }
        } else if (tabPragmatist[1] > 20) {
            if (tabTheorist[1] > 40) {
                scoreConvergeur = 4;
            } else if (tabTheorist[1] > 20) {
                scoreConvergeur = 3;
            } else {
                scoreConvergeur = 2;
            }
        } else if (tabPragmatist[1] > -40) {
            if (tabTheorist[1] > 40) {
                scoreConvergeur = 4;
            } else if (tabTheorist[1] > -40) {
                scoreConvergeur = 3;
            } else {
                scoreConvergeur = 2;
            }
        } else {
            if (tabPragmatist[1] > 40) {
                scoreConvergeur = 3;
            } else if (tabTheorist[1] > 20) {
                scoreConvergeur = 2;
            } else {
                scoreConvergeur = 1;
            }
        }

        //Assimilateur
        if (tabTheorist[1] > 40) {
            if (tabReflector[1] > 40) {
                scoreAssimilateur = 5;
            } else if (tabReflector[1] > 20) {
                scoreAssimilateur = 4;
            } else {
                scoreAssimilateur = 3;
            }
        } else if (tabTheorist[1] > 20) {
            if (tabReflector[1] > 40) {
                scoreAssimilateur = 4;
            } else if (tabReflector[1] > 20) {
                scoreAssimilateur = 3;
            } else {
                scoreAssimilateur = 2;
            }
        } else if (tabTheorist[1] > -40) {
            if (tabReflector[1] > 40) {
                scoreAssimilateur = 4;
            } else if (tabReflector[1] > -40) {
                scoreAssimilateur = 3;
            } else {
                scoreAssimilateur = 2;
            }
        } else {
            if (tabReflector[1] > 40) {
                scoreAssimilateur = 3;
            } else if (tabReflector[1] > 20) {
                scoreAssimilateur = 2;
            } else {
                scoreAssimilateur = 1;
            }
        }

        //Divergeur
        if (tabActivist[1] > 40) {
            if (tabReflector[1] > 40) {
                scoreDivergeur = 5;
            } else if (tabReflector[1] > 20) {
                scoreDivergeur = 4;
            } else {
                scoreDivergeur = 3;
            }
        } else if (tabActivist[1] > 20) {
            if (tabReflector[1] > 40) {
                scoreDivergeur = 4;
            } else if (tabReflector[1] > 20) {
                scoreDivergeur = 3;
            } else {
                scoreDivergeur = 2;
            }
        } else if (tabActivist[1] > -40) {
            if (tabReflector[1] > 40) {
                scoreDivergeur = 4;
            } else if (tabReflector[1] > -40) {
                scoreDivergeur = 3;
            } else {
                scoreDivergeur = 2;
            }
        } else {
            if (tabReflector[1] > 40) {
                scoreDivergeur = 3;
            } else if (tabReflector[1] > 20) {
                scoreDivergeur = 2;
            } else {
                scoreDivergeur = 1;
            }
        }
    }

    function preferences() {
        let activist = data.dataProfil.activist;
        let reflector = data.dataProfil.reflector;
        let theorist = data.dataProfil.theorist;
        let pragmatist = data.dataProfil.pragmatist;

        if (activist > 12) {
            tabActivist = [0, 80];
            score = 5;
        } else if (activist > 10) {
            tabActivist = [0, 40];
            score = 4;
        } else if (activist > 6) {
            tabActivist = [-20, 20];
            score = 3;
        } else if (activist > 3) {
            tabActivist = [0, -40];
            score = 2;
        } else {
            tabActivist = [0, -80];
            score = 1;
        }

        if (reflector > 17) {
            tabReflector = [0, 80];
            score += 5;
        } else if (reflector > 14) {
            tabReflector = [0, 40];
            score += 4;
        } else if (reflector > 11) {
            tabReflector = [-20, 20];
            score += 3;
        } else if (reflector > 8) {
            tabReflector = [0, -40];
            score += 2;
        } else {
            tabReflector = [0, -80];
            score += 1;
        }

        if (theorist > 15) {
            tabTheorist = [0, 80];
            score += 5;
        } else if (theorist > 13) {
            tabTheorist = [0, 40];
            score += 4;
        } else if (theorist > 10) {
            tabTheorist = [-20, 20];
            score += 3;
        } else if (theorist > 7) {
            tabTheorist = [0, -40];
            score += 2;
        } else {
            tabTheorist = [0, -80];
            score += 1;
        }

        if (pragmatist > 16) {
            tabPragmatist = [0, 80];
            score += 5;
        } else if (pragmatist > 14) {
            tabPragmatist = [0, 40];
            score += 4;
        } else if (pragmatist > 11) {
            tabPragmatist = [-20, 20];
            score += 3;
        } else if (pragmatist > 8) {
            tabPragmatist = [0, -40];
            score += 2;
        } else {
            tabPragmatist = [0, -80];
            score += 1;
        }

        score = Math.round(score / 4);

    }

    function emotions() {
        let dataExpression = data.dataExpression;
        let counter = 0;
        streamExpression.colere.length = 0;
        streamExpression.degout.length = 0;
        streamExpression.peur.length = 0;
        streamExpression.joie.length = 0;
        streamExpression.triste.length = 0;
        streamExpression.surprise.length = 0;

        dataExpression.forEach(function (expressions) {
            for (const [expression, value] of Object.entries(expressions.FaceExpression)) {

                if (expression == 'colere' && value > 0) {
                    colere.count += 1;
                    colere.total += value;
                    streamExpression.colere.push({
                        x: expressions.created,
                        y: value,
                    });
                    if (colere.best < value) {
                        colere.best = value;
                        colere.image = expressions.FaceDetection.image;
                        colere.key = counter;
                    }
                    console.log(colere);
                }
                if (expression == 'degout' && value > 0) {
                    degout.count += 1;
                    degout.total += value;
                    streamExpression.degout.push({
                        x: expressions.created,
                        y: value,
                    });
                    if (degout.best < value) {
                        degout.best = value;
                        degout.image = expressions.FaceDetection.image;
                        degout.key = counter;
                    }
                }
                if (expression == 'peur' && value > 0) {
                    peur.count += 1;
                    peur.total += value;
                    streamExpression.peur.push({
                        x: expressions.created,
                        y: value,
                    });
                    if (peur.best < value) {
                        peur.best = value;
                        peur.image = expressions.FaceDetection.image;
                        peur.key = counter;
                    }
                }
                if (expression == 'joie' && value > 0) {
                    joie.count += 1;
                    joie.total += value;
                    streamExpression.joie.push({
                        x: expressions.created,
                        y: value,
                    });
                    if (joie.best < value) {
                        joie.best = value;
                        joie.image = expressions.FaceDetection.image;
                        joie.key = counter;
                    }
                }
                if (expression == 'triste' && value > 0) {
                    triste.count += 1;
                    triste.total += value;
                    streamExpression.triste.push({
                        x: expressions.created,
                        y: value,
                    });
                    if (triste.best < value) {
                        triste.best = value;
                        triste.image = expressions.FaceDetection.image;
                        triste.key = counter;
                    }
                }
                if (expression == 'surprise' && value > 0) {
                    surprise.count += 1;
                    surprise.total += value;
                    streamExpression.surprise.push({
                        x: expressions.created,
                        y: value,
                    });
                    if (surprise.best < value) {
                        surprise.best = value;
                        surprise.image = expressions.FaceDetection.image;
                        surprise.key = counter;
                    }
                }
                if (neutre == 'neutre' && value > 0) {
                    neutre.count += 1;
                    neutre.total += value;
                    if (neutre.best < value) {
                        neutre.best = value;
                        neutre.image = expressions.FaceDetection.image;
                        neutre.key = counter;
                    }
                }
                counter++;
            }
        });
    }
</script>
<style>

    .card i{
        float: left;
        font-size: 0.75em;
        padding: 0;
        margin-left: 0.5em;
    }

    .slot h4{
        float: left;
        font-size: 1.5rem;
        margin-bottom: 0;
    }

</style>
<section class="">
    {#if jsonTrainer.length === 0}
        <Loading />
    {:else}
        <!-- Profil apprenant -->
        <div class="columns is-multiline has-background-white">
            <div class="column is-half">
                <div class="tile">
                    <article class="tile is-child is-info">
                        <p class="title">Votre profil d'apprenant est : {profil}</p>
                        {#if profil == "ADAPTATEUR"}
                            <SimpleAdaptateur score="{score}" />
                        {:else if profil == "DIVERGEUR"}
                            <SimpleDivergeur score="{score}" />
                        {:else if profil == "ASSIMILATEUR"}
                            <SimpleAssimilateur score="{score}" />
                        {:else if profil == "CONVERGEUR"}
                            <SimpleConvergeur score="{score}" />
                        {/if}
                        <div class="tile is-parent">
                            <BarKolb
                                    userId={userId}
                                    tabActivist={tabActivist}
                                    tabReflector={tabReflector}
                                    tabTheorist={tabTheorist}
                                    tabPragmatist={tabPragmatist}
                            />
                        </div>
                    </article>
                </div>
            </div>
            <div class="column is-half">
                <div class="tile is-parent">
                    <RadarKolb
                            userId={userId}
                            activist={data.dataProfil.activist}
                            reflector={data.dataProfil.reflector}
                            theorist={data.dataProfil.theorist}
                            pragmatist={data.dataProfil.pragmatist}
                    />
                </div>
            </div>
            <div class="column is-full">
                <div class="card is-shady">
                    <div class="card-content">
                        <div class="" >
                            <Accordion isOpen="{profil == 'ADAPTATEUR'}">
                                <div class="slot" slot="head">
                                    <h4>L’ADAPTATEUR</h4>
                                    <i class="fa-solid fa-screwdriver-wrench"></i>
                                </div>
                                <div slot="details">
                                    <div class="columns">
                                        <div class="column is-three-quarters">
                                            <Adaptateur/>
                                        </div>
                                        <div class="column">
                                            <SimpleAdaptateur score="{scoreAdaptateur}" />
                                        </div>
                                    </div>

                                </div>
                            </Accordion>
                        </div>

                    </div>
                </div>
            </div>
            <div class="column is-full">
                <div class="card is-shady">
                    <div class="card-content">
                        <div class="" >
                            <Accordion isOpen="{profil == 'DIVERGEUR'}">
                                <div class="slot" slot="head">
                                    <h4>LE DIVERGEUR</h4>
                                    <i class="fa-solid fa-guitar"></i>
                                </div>
                                <div slot="details">
                                    <div class="columns">
                                        <div class="column is-three-quarters">
                                            <Divergeur/>
                                        </div>
                                        <div class="column">
                                            <SimpleDivergeur score="{scoreDivergeur}" />
                                        </div>
                                    </div>
                                </div>
                            </Accordion>
                        </div>

                    </div>
                </div>
            </div>
            <div class="column is-full">
                <div class="card is-shady">
                    <div class="card-content">
                        <div class="" >
                            <Accordion isOpen="{profil == 'ASSIMILATEUR'}">
                                <div class="slot" slot="head">
                                    <h4>L’ASSIMILATEUR</h4>
                                    <i class="fa-solid fa-flask"></i>
                                </div>
                                <div slot="details">
                                    <div class="columns">
                                        <div class="column is-three-quarters">
                                            <Assimilateur/>
                                        </div>
                                        <div class="column">
                                            <SimpleAssimilateur score="{scoreAssimilateur}" />
                                        </div>
                                    </div>
                                </div>
                            </Accordion>
                        </div>

                    </div>
                </div>
            </div>
            <!-- Convergeur -->
            <div class="column is-full">
                <div class="card is-shady">
                    <div class="card-content">
                        <div class="" >
                            <Accordion isOpen="{profil == 'CONVERGEUR'}">
                                <div class="slot" slot="head">
                                    <h4>LE CONVERGEUR</h4>
                                    <i class="fa-solid fa-rocket"></i>
                                </div>
                                <div slot="details">
                                    <div class="columns">
                                        <div class="column is-three-quarters">
                                            <Convergeur/>
                                        </div>
                                        <div class="column">
                                            <SimpleConvergeur score="{scoreConvergeur}" />
                                        </div>
                                    </div>
                                </div>
                            </Accordion>
                        </div>

                    </div>
                </div>
            </div>

            <!-- Profil emotionnel -->
            <div class="column is-full">
                <div class="container has-text-centered">
                    <h2 class="title">Votre profil émotionnel</h2>
                    <Vignettes
                            colere={colere}
                            neutre={neutre}
                            joie={joie}
                            degout={degout}
                            peur={peur}
                            surprise={surprise}
                            triste={triste}
                    />
                    </div>

                    <div class="tile is-ancestor">

                    </div>
            </div>

            <div class="column is-full">
                <div class="tile">
                    <article class="tile is-child is-info">
                        <StreamKolb/>
                    </article>
                </div>
            </div>
            <div class="column is-half">
                <div class="tile is-parent">
                    <RadarKolb
                            userId={userId}
                            activist={data.dataProfil.activist}
                            reflector={data.dataProfil.reflector}
                            theorist={data.dataProfil.theorist}
                            pragmatist={data.dataProfil.pragmatist}
                    />
                </div>
            </div>
            <div class="column is-half">
                <div class="tile is-parent">
                    <BarKolb
                            userId={userId}
                            tabActivist={tabActivist}
                            tabReflector={tabReflector}
                            tabTheorist={tabTheorist}
                            tabPragmatist={tabPragmatist}
                    />
                </div>
            </div>
        </div>

        <!-- Print -->
        <div class="buttons are-medium notification">
            <button class="button are-medium center is-link is-rounded">
                                <span class="icon">
                                    <i class="fa-solid fa-print"></i>
                                </span>
                <span>Imprimer</span>
            </button>
        </div>
    {/if}
</section>