<script>

    import {baseUrl, dataExpression, kolbReponse} from "../../data";
    import {userIdtStore} from "../../stores";
    import ChartKolb from "./ChartKolb.svelte";

    let userId;
    let c1 = 0;
    let c2 = 0;
    let c3 = 0;
    let c4 = 0;
    let proactifAnalytique = 0;
    let abstraitConcret = 0;
    let method = "PUT";

    for (let i = 0; i < kolbReponse.length; i++) {
        if ((i + 1) % 2) {
            if (i < 13) {
                c1++;
            } else {
                c3++;
            }
        } else {
            if (i < 13) {
                c2++;
            } else {
                c4++;
            }
        }
    }

    proactifAnalytique = c1 + c2;
    abstraitConcret = c3 + c4;

    userIdtStore.subscribe(value => {
        userId = value;
    });

    let updateKolb = async () => {

        URL = `${baseUrl}/kolb/${userId}`;

        let data = {
            kolb: {
                resultat: {
                    proactifAnalytique: proactifAnalytique,
                    abstraitConcret: abstraitConcret
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

    updateKolb();

</script>
<style></style>

<div class="columns trainx center is-vcentered is-multiline">
    <div class="column is-full">
        <div class="columns notification is-info">
            <div class="column is-two-thirds">

            </div>
            <div class="column is-one-third">
                <div class="tile is-parent">
                    <ChartKolb/>
                </div>
            </div>
        </div>
    </div>
    <div class="column">

    </div>
</div>
