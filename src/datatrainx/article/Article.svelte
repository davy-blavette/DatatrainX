<script>
    import * as animateScroll from "svelte-scrollto";
    import {layoutStore} from "../../stores";


</script>

<style>
    .figure {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        margin: 2em 0;
    }
    .figure-caption {
        font-size: 13px;
        margin-top: 5px;
    }
</style>

<div class="container">
    <div class="tile is-parent">
        <div class="tile is-child">
            <h1 class="title">DataTrainX c'est quoi ?</h1>
            <p class="subtitle">Outil de recherche des singularités cognitives d’un étudiant!</p>
            <article class="content">
                <p>Dans l’apprentissage, une logique de la restitution qui prévaut encore sur une logique de la compréhension serait à l’origine de nombreux échecs de l’apprenant. Pour se comprendre, comprendre le monde et autrui, tout apprenant produit et met en œuvre des ressources métacognitives.</p>
                <p>On observera que cela fait appel à de nombreuses disciplines, comme la psychologie, la pédagogie, les neurosciences mais aussi le management, qui demandera à l’équipe enseignante une formation continue pour s’appuyer sur de tels dispositifs.</p>
                <p>DataTrainX est un prototype de reconnaissance facial des émotions (REF) qui a pour objectif principal de s’intéresser à l’analyse des comportements de l'apprenant dans un but de neuropédagogie.</p>
                <p>Cela peut être très utile dans l'adaptation des modèles d’apprentissage où, en analysant les comportements, on serait en mesure de s’adapter à l’apprenant (adaptive-learning).</p>
                <p>DataTrainX est un agent intelligent capable de reconnaître les émotions traduites par les expressions faciales couplées au test de Kolb sur le style d’apprentissage.</p>
                <p>Pour ce faire, nous utiliserons des algorithmes de deep-Learning et plus particulièrement les réseaux de neurones convolutifs (CNN) dans la reconnaissance des émotions de bases défini par le psychologue P. Ekman ('Colère', 'Dégoût', 'Peur', 'Joyeux', 'Triste', 'Surprise', 'Neutre').</p>
                <h3>Principe d'un réseau de neurones convolutifs - Deep Learning</h3>
                <p>Les réseaux de neurones convolutifs ont une méthodologie similaire à celle des méthodes traditionnelles d'apprentissage supervisé, ils détectent les caractéristiques, puis entraînent un classifieur dessus, à la différence près que les caractéristiques sont apprises automatiquement. Un CNN applique généralement 5 types de couches différentes à une image afin d’en extraire les informations pertinentes, la couche de convolution, la couche de pooling, la couche de correction ReLU et la couche fully-connected (figure 1).</p>
                <div class="figure">
                    <img src="PUBLIC_URL/assets/figures/cnn.gif" alt="Principe d'une architecture CNN" />
                    <div class="figure-caption">
                        Figure 1. Principe d'une architecture CNN
                    </div>
                </div>
                <p>La couche de convolution permet de trouver des caractéristiques, elle est donc la composante la plus importante. Elle est assez proche de la mécanique sur les caractéristiques pseudo-Haar. Le principe est le même, faire "glisser" une fenêtre représentant un filtre sur l'image. La différence ici, c’est que l’on cherche une convolution calculée et non une corrélation croisée (comme la recherche d’une caractéristiques pseudo-haar).</p>
                <p>Le filtre, sera la caractéristique à étudier, cette caractéristique est trouvée par convolution, pour comprendre l’application nous simplifions l’image du visage par une croix noirs et blanche (figure 2). La caractéristique (feature) dans cet exemple prend la taille de 3x3 puis recherche des points communs par balayage de l’image. Dans la démonstration nous avons pris la valeur d’un pixel en 2D, 1 pour blanc et -1 pour noir, ainsi entre deux caractéristiques comparées nous réalisons un calcul d’addition entre les 9 pixels ce qui nous permet d’obtenir un score de similarité, ici 80%. Ce même calcul est réalisé sur l’ensemble  de l’image avec un stride de 1 (la zone comparée bouge d’un seul pixel entre chaque comparaison).</p>
                <div class="figure">
                    <img src="PUBLIC_URL/assets/figures/relu.gif" alt="Principe de convolution est de l'activation ReLU" />
                    <div class="figure-caption">
                        Figure 2. Principe de convolution est de l'activation ReLU, ici la comparaison entre les deux images permettent de trouver trois caractéristiques, l'une des caractéristiques (en vert) est nettoyer ensuite des valeurs négatives (ReLU)
                    </div>
                </div>
                <p>Nous avons adaptés le projet <a href="https://poloclub.github.io/cnn-explainer/" target="_blank">CNN Explainer</a> pour en comprendre le principe sur un dataset fer2013.</p>
                <div class="buttons center">
                    <button class="button is-primary" id="explain-button" on:click={() => animateScroll.scrollTo({element: "#header", onDone: (element, offset) => {layoutStore.setLayout("cnn")}}) }>
                            <span class="icon">
                              <i class="fas fa-eye"></i>
                            </span>
                        <span>Comment ça marche ?</span>
                    </button>
                </div>
                <p>L’idée est de se concentrer sur la démarche que privilégie chaque individu pour appréhender l’acte d’apprendre. Certains styles seraient plus adaptés dans certains contextes que d’autres. Tout dépend du point de vue de l’apprenant face à la situation d’apprentissage et de sa motivation.</p>
                <p>Bien que des auteurs comme Jean Houssaye démontrent que ce qui semble essentiel c’est de différencier la pédagogie bien plus que des typologies destinées à connaître individuellement les apprenants et à dresser leur profil, il parait néanmoins intéressant de les utiliser comme complémentarité à un panel d’outil diversifié que peut utiliser le formateur.</p>
                <h3>Le modèle de l’apprentissage expérientiel de Kolb</h3>
                <p>Les modèles de styles d’apprentissage individualisés ont donc pour objectif de définir un type d’apprenant afin de permettre aux enseignants d’adapter leurs méthodes d’apprentissage.</p>
                <p>Peu d’études ont réussi à valider le concept de styles d’apprentissage en éducation. L’étude de Pashler et al indique bien une corrélation entre typologies et les préférences exprimées par certains individus sur la façon dont ils préfèrent recevoir de l’information mais contredit le fait selon laquelle l’apprenant apprendrait mieux en apprenant avec une méthode jugée comme appropriée à son style d’apprentissage</p>
                <p>Nombreux sont les scientifiques qui parle de mythe ou invitent les professionnels de l’éducation et d’apprentissage à faire preuve de scepticisme devant ces concepts. Le modèle de Kolb n’échappe pas non plus aux critiques mais il est de loin celui qui a connu la plus large diffusion et celui qui est à la base de modèle d’autres chercheurs.</p>
                <p>Il est inspiré des travaux de psychologue reconnu comme John Dewey, Kurt Lewin et Jean Piaget. Il est plutôt approprié pour les apprentissages de disciplines académiques relativement abstraites, mais moins adaptés pour la plupart des apprentissages professionnels.</p>
                <p>D’un autre côté, notre cible d’étude est réalisée sur des universitaires en informatique, ce test nous semble donc plutôt approprié.</p>
                <p>Ce qu’il faut retenir des principales critiques, c’est qu’étiqueter un apprenant et le cantonner dans une posture est strictement contre-productif et va à l’inverse de l’objectif recherché. Néanmoins, ce qu’il ressort aussi, ce sont des concepts génériques qui fonctionnent.</p>
                <p>Par exemple, un profil « indépendants » a tendance à questionner les novices alors que le profil « socialisant » propose des aides, les « socialisants » s’adaptent à leur interlocuteur, quel que soit le style du novice, ceux qui travaillent avec un expert « socialisant » progressent le plus.</p>
                <p>On peut donc constater que les styles d’apprentissage, nous ouvre une voie pour des recherches sur les interactions sociales entre formateurs et apprenants. Pour des raisons à la fois pratiques et théoriques, il faut retenir la « maniabilité » des styles mais que cependant ils paraissent suffisamment stables pour qu’on puisse les prendre en compte dans une situation donnée afin de contribuer à expliquer ses comportements d’apprentissage. Puis enfin, garder à l’esprit qu’en modifiant de façon significative la situation d’apprentissage, il est possible qu’un individu modifie son style préférentiel d’apprentissage. Enfin, le facteur que l’on souhaite ajouter à notre projet et l’expression de l’émotion corrélé au type d’apprentissage.</p>
                <h3>Typologie d’apprentissage et émotions</h3>
                <p>Il y aura donc une phase de saisie d’un questionnaire afin de déterminer un profil d’apprenant de type Kolb dans le projet DataTrainx. L’utilisateur sera enregistré en vidéo et une comparaison sera effectuée entre la typologie trouvée par le questionnaire et les émotions qu’il aura exprimées. Comme l’illustre la figure ci-dessous, l’objectif est de trouver une corrélation entre la typologie d’apprentissage et l’émotion de l’utilisateur.</p>
                <div class="figure">
                    <img src="PUBLIC_URL/assets/figures/style.gif" alt="Exemple de restitution des résultats de l’application DataTrainX." />
                    <div class="figure-caption">
                        Figure 3. Exemple de restitution des résultats de l’application DataTrainX. Obtenir un profil d’apprenant, analyser l’émotion dans une mise en situation, trouver une corrélation.
                    </div>
                </div>
                <p>Dans l’hypothèse où nous aurions des résultats significatifs entre expression et typologie, nous pourrions considérer que le profil émotionnel même de l’émotion détermine la typologie d’apprentissage et donc envisager, par exemple, une orientation du logiciel vers l’adaptative learning, c’est-à-dire une interaction entre l’IA et l’utilisateur dans la proposition des supports pédagogique.</p>
                <p>L’objet de ce projet, a pour orientation de se focaliser concrètement sur les moyens fonctionnels informatique à mettre en œuvre pour ce type d’application. Nous n’approfondirons pas l’aspect psychologique, qui se limitera au test de Kolb et à la résolution d’un Puzzle, l’objectif étant de démontrer comment mettre en place l’architecture fonctionnelle, logicielle et matérielle pour arriver à un résultat applicatif de la reconnaissance faciale de l’émotion.</p>
                <p>Les résultats d’ordre psychologique à prendre en considération sur l’objectif de cette application auront donc une part importante de subjectivité clairement assumé.</p>
                <div class="buttons center">
                    <button class="button is-primary" id="explain-button" on:click={() => animateScroll.scrollTo({element: "#header", onDone: (element, offset) => {layoutStore.setLayout("presentation")}}) }>
                            <span class="icon">
                              <i class="fa-solid fa-angles-up"></i>
                            </span>
                        <span>Faire le test</span>
                    </button>
                </div>
            </article>
        </div>
    </div>
</div>
