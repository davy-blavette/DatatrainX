<script>
    import {onMount} from "svelte";
    import {baseUrl} from "../service-factory/data";
    import JSONTree from 'svelte-json-tree';
    import Loading from "./utils/Loading.svelte";
    import {infoLoadStore, loadingStore, userIdtStore, userTokenStore} from "../stores";

    let jsonTrainers = [];
    let jsonTreedataProfil;
    let jsonTreedataExpression;
    let jsonTreedataCondition;
    let loading;

    loadingStore.subscribe(value => {
        loading = value;
    });

    infoLoadStore.set("Chargement JSON...");

    onMount(async () => {
        let res = await fetch(baseUrl);

        const trainer = res.json();
        trainer.then(function(result) {
            jsonTrainers.push(result);
            jsonTreedataProfil = jsonTrainers[0]["dataProfil"];
            jsonTreedataExpression = jsonTrainers[0]["dataExpression"];
            jsonTreedataCondition = jsonTrainers[0]["dataCondition"];

            //jsonTrainers.push(result.dataCondition.json());
            //jsonTrainers.push(result.dataProfil.json());
        });
    });




</script>
<style>
    .circle-container {
        position: relative;
        max-width: 44px;
    }
    .circle-icon {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        -webkit-box-align: center;
        align-items: center;
        -webkit-box-pack: center;
        justify-content: center;
        height: 28px;
        width: 28px;
        min-width: 28px;
        color: #444f60;
    }
    .circle-icon span {
        position: relative;
        top: -2px;
        right: -2px;
        font-weight: 700;
        color: #444f60;
        font-size: .9rem;
    }
    .info{
        margin-left: 30PX;
    }
    .info p{
        font-weight: bold;
        width: max-content;
    }
    .info i{
        border-radius: 4px;
        padding: 1em;
        position: absolute;
        left: -10px;
        color: white;
        box-shadow: 2px 2px 2px 0px rgb(59 6 94);
    }
</style>
<section class="container is-fluid">
{#if jsonTrainers.length === 1}
    <Loading />
{:else}
    <div class="columns">
        <div class="column">
            <div class="tile-content notification is-ligh">
                <div class="info">
                    <i class="has-background-link fa-solid fa-users"></i>
                    <h3>Profils</h3>
                    <p class="">2 552</p>
                </div>
            </div>
        </div>
        <div class="column">
            <div class="tile-content notification is-ligh">
                <div class="info">
                    <i class="has-background-success fa-solid fa-face-grin-beam"></i>
                    <h3>Emotions</h3>
                    <p class="">8 556 259</p>
                </div>
            </div>
        </div>
        <div class="column">
            <div class="tile-content notification is-ligh">
                <div class="info">
                    <i class="has-background-primary fa-solid fa-check"></i>
                    <h3>Réponses</h3>
                    <p class="">55 052</p>
                </div>
            </div>
        </div>
        <div class="column">
            <div class="tile-content notification is-ligh">
                <div class="info">
                    <i class="has-background-warning fa-solid fa-square-poll-vertical"></i>
                    <h3>Resultats</h3>
                    <p class="">10 259</p>
                </div>
            </div>
        </div>
    </div>
    <div class="columns is-multiline">
        <!--Table Widget-->
        <div class="column is-12">
            <div class="widget table-widget">
                <table class="table container is-fluid">
                    <thead>
                    <tr>
                        <th>#</th>
                        <th>Completed</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>DataProfil</th>
                        <th>DataCondition</th>
                        <th>DataExpression</th>
                    </tr>
                    </thead>
                    <tbody>
                            <tr>
                                <td class="light-cell">
                                    <span>{1}</span>
                                </td>
                                <td>
                                    <div class="circle-container">
                                        <svg class="circle-chart" viewBox="0 0 33.83098862 33.83098862" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
                                            <circle class="circle-chart-background" stroke="#efefef" stroke-width="2" fill="none" cx="16.91549431" cy="16.91549431" r="15.91549431"></circle>
                                            <circle class="circle-chart-circle" stroke="#7F00FF" stroke-width="2" stroke-dasharray="100,100" stroke-linecap="round" fill="none" cx="16.91549431" cy="16.91549431" r="15.91549431"></circle>
                                        </svg>
                                        <div class="circle-icon">
                                            <span>100%</span>
                                        </div>
                                    </div>
                                </td>
                                <td class="light-cell">Jun 22 2022</td>
                                <td>
                                    <span class="tag is-curved">Canceled</span>
                                    <span class="tag is-curved">Assimilateur</span>
                                </td>
                                <td class="">
                                    <JSONTree value={jsonTreedataProfil} />
                                </td>
                                <td class="">
                                    <JSONTree value={jsonTreedataCondition} />
                                </td>
                                <td class="">
                                    <JSONTree value={jsonTreedataExpression} />
                                </td>
                            </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
{/if}
</section>
