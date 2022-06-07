<script>
    import {onMount} from "svelte";
    import {infoLoadStore, layoutTrainxStore, loadingStore, userIdtStore} from "../../stores";
    import RadarKolb from "./RadarKolb.svelte";
    import {baseUrl, chartExpressions, streamExpression} from "../../service-factory/data";
    import Loading from "../utils/Loading.svelte";
    import BarKolb from "./BarKolb.svelte";

    import Adaptateur from "./profil/Adaptateur.svelte";
    import Divergeur from "./profil/Divergeur.svelte";
    import Assimilateur from "./profil/Assimilateur.svelte";
    import Convergeur from "./profil/Convergeur.svelte";
    import AdaptateurSimple from "./profil/AdaptateurSimple.svelte";
    import DivergeurSimple from "./profil/DivergeurSimple.svelte";
    import AssimilateurSimple from "./profil/AssimilateurSimple.svelte";
    import ConvergeurSimple from "./profil/ConvergeurSimple.svelte";
    import Accordion from "../utils/Accordion.svelte";
    import Vignettes from "./profil/Vignettes.svelte";
    import StreamKolb from "./StreamKolb.svelte";
    import RadarExpression from "./RadarExpression.svelte";
    import BarExpression from "./BarExpression.svelte";

    //fin enregistrement
    layoutTrainxStore.setLayout("");
    let userId;
    let jsonTrainer = [];
    let loading;
    let data;
    let composants = [
        {
            label:"adaptateur",
            simple:AdaptateurSimple,
            full:Adaptateur,
            icon:'fa-screwdriver-wrench'
        },
        {
            label:"assimilateur",
            simple:AssimilateurSimple,
            full:Assimilateur,
            icon:'fa-flask'
        },
        {
            label:"convergeur",
            simple:ConvergeurSimple,
            full:Convergeur,
            icon:'fa-rocket'
        },
        {
            label:"divergeur",
            simple:DivergeurSimple,
            full:Divergeur,
            icon:'fa-guitar'
        }
    ];

    userIdtStore.subscribe(value => {
        userId = value;
    });

    if (!userId) {
        userId = "629d0c575f399943f104558b";
    }

    infoLoadStore.set("Chargement Resultats...");

    onMount(async () => {
        let res = await fetch(`${baseUrl}/dataProfil/${userId}`);
        jsonTrainer = [await res.json()];
        data = Object.values(jsonTrainer)[0].dataProfil;
    });

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
<section class="container">
    {#if jsonTrainer.length === 0}
        <Loading />
    {:else}
        <!-- Profil apprenant -->
        <div class="columns is-multiline has-background-white">
            <div class="column is-half">
                <div class="tile">
                    <article class="tile is-child is-info">
                        <p class="title">Votre profil d'apprenant est : {data.apprenant.profil}</p>
                        {#each Object.entries(data.apprenant.dim2) as [type, score], i}
                            {#if data.apprenant.profil.toLowerCase().includes(type)}
                                <svelte:component this={composants[i].simple} score={score}/>
                            {/if}
                        {/each}
                    </article>
                </div>
            </div>
            <div class="column is-half">
                <div class="container is-parent">
                    <RadarKolb
                            userId={userId}
                            data={data.apprenant.dim1}
                    />
                    <div class="container is-parent">
                        <BarKolb
                                userId={userId}
                                data={data.apprenant.dim1}
                        />
                    </div>
                </div>
            </div>
            {#each composants as value}
                <div class="column is-full">
                    <div class="card is-shady">
                        <div class="card-content">
                            <div class="" >
                                <Accordion isOpen="{data.apprenant.profil.toLowerCase().includes(value.label)}">
                                    <div class="slot" slot="head">
                                        <h4>{value.label.toUpperCase()}</h4>
                                        <i class="fa-solid {value.icon}"></i>
                                    </div>
                                    <div slot="details">
                                        <div class="columns">
                                            <div class="column is-three-quarters">
                                                <svelte:component this={value.full}
                                                                  activist={data.apprenant.dim1.activist.score}
                                                                  reflector={data.apprenant.dim1.reflector.score}
                                                                  theorist={data.apprenant.dim1.theorist.score}
                                                                  pragmatist={data.apprenant.dim1.pragmatist.score}
                                                />
                                            </div>
                                            <div class="column">
                                                <svelte:component this={value.simple} score={data.apprenant.dim2[value.label]}/>
                                            </div>
                                        </div>
                                    </div>
                                </Accordion>
                            </div>
                        </div>
                    </div>
                </div>
            {/each}

            <!-- Profil emotionnel -->
            <div class="column is-full">
                <div class="container has-text-centered">
                    <h2 class="title">Votre profil émotionnel</h2>
                    <Vignettes
                            profil={data.apprenant.profil}
                            resultatExpressions={data.expressions.resultatExpressions}
                    />
                    </div>
            </div>

            <div class="column is-full">
                <div class="tile">
                    <article class="tile is-child is-info">
                        <StreamKolb
                                userId={userId}
                        />
                    </article>
                </div>
            </div>
            <div class="column is-half">
                <div class="tile is-parent">
                    <RadarExpression
                            profil={data.apprenant.profil}
                            expressions={data.expressions.resultatExpressions}
                    />
                </div>
            </div>
            <div class="column is-half">
                <div class="tile is-parent">
                    <BarExpression
                            profil={data.apprenant.profil}
                            total={data.expressions.score}
                    />
                </div>
            </div>
            <!-- Print -->
            <div class="column is-full">
                <div class="buttons are-medium notification">
                    <button class="button are-medium center is-link is-rounded" on:click={() => window.print() }>
                        <span class="icon">
                            <i class="fa-solid fa-print"></i>
                        </span>
                        <span>Imprimer</span>
                    </button>
                </div>
            </div>
        </div>
    {/if}
</section>