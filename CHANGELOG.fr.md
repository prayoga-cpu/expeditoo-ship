# Journal des versions

Tous les changements notables d'EXPEDITOO sont documentés ici, du plus récent au
plus ancien.

Ce fichier est la **traduction française** de [`CHANGELOG.md`](./CHANGELOG.md),
qui reste la source de vérité des versions. `/changelog` l'affiche aux
visiteurs francophones. Chaque version y figure avec le même en-tête, le même
nombre d'éléments que l'original ; `pnpm changelog:check` refuse une version qui n'est pas traduite, dont les
éléments ne correspondent pas ou dont un élément est resté en anglais.

Format : `## [version] - AAAA-MM-JJ · tag` où `tag` ∈ `feat | fix | infra | ux`
(l'en-tête est recopié tel quel depuis `CHANGELOG.md`). Rédigé pour celles et
ceux qui utilisent la plateforme — transporteurs, opérateurs et clients. La
partie technique de chaque version se trouve dans [`STATUS.md`](./STATUS.md).

L'historique antérieur à la `2.0.0` appartient à la place de marché de biens de
la v1 et n'est pas conservé : la première version ci-dessous est le commit qui a
lancé le virage vers le transport.

## [2.99.2] - 2026-11-25 · fix

Le titre de la page d'accueil reprend exactement les mots du client.

- **Titre de la page d'accueil : « Ajouter partagé après transport ».** Le titre
  reprend les mots du client, tels quels, en français et en anglais.

## [2.99.1] - 2026-11-25 · fix

Le titre de la page d'accueil dit maintenant ce que le client a demandé.

- **Titre de la page d'accueil : « Trouvez un transport partagé pour vos objets ».**
  Le mot « partagé » suit désormais « transport », comme dans le bandeau
  au-dessus, au lieu de « transporteur ».

## [2.99.0] - 2026-11-25 · ux

Le site s'ouvre tout de suite dans votre langue, le logo mène au site web, et quelques corrections issues des retours du jour.

- **Le site s'ouvre désormais dans votre langue dès le premier instant.** Un
  téléphone ou un ordinateur réglé en anglais affiche l'anglais tout de suite,
  sans une seconde de français puis un basculement ; toute autre langue ouvre le
  site en français. Le bouton de langue garde le dernier mot, et votre choix est
  retenu.
- **Ouvrir le site web depuis l'application.** Le logo en haut du menu — et
  celui en haut de l'écran sur un téléphone — vous amène maintenant sur le site
  public, quel que soit l'espace dans lequel vous êtes. « Ouvrir l'app » sur le
  site vous y ramène, et l'accueil reste dans le menu.
- **« Mes trajets » : l'adresse ne change plus toute seule.** Chercher un lieu
  de départ ou d'arrivée remplissait les champs sous la carte avec une autre
  adresse, et une deuxième recherche laissait le texte de la première. Le lieu
  choisi est maintenant celui qui s'écrit ; une ville laisse la rue vide pour que
  vous la complétiez, et ce que vous avez tapé vous-même n'est jamais écrasé.
- **« Mes offres » a sa propre icône.** Le marteau d'enchères est remplacé par
  une icône de prix dans le menu, la barre du bas, le tableau de bord et sur les
  cartes de mission : ici, une offre est un prix pour un transport, pas une
  enchère.
- **Page d'accueil : « partagé », le bandeau, et un mot en moins.** Le titre
  invite maintenant à trouver un « transporteur partagé ». La ligne en haut de la
  page indique « Transport partagé d'objets, meubles et déménagements · France
  et étranger », se place au milieu, plus haut, dans une police plus grande. Le
  mot « vérifiés » ne suit plus « transporteurs » nulle part sur le site, dans
  les titres de pages ni dans l'e-mail de bienvenue.

## [2.98.0] - 2026-11-25 · ux

Une relecture de chaque mot dans les deux langues, un aspect plus sobre sur le site comme dans l'application, et une nouvelle section qui montre l'application de l'intérieur.

- **Les textes ont été relus ligne par ligne, en français et en anglais.** Plus de
  550 libellés et phrases ont été corrigés : erreurs de traduction, vocabulaire
  d'enchères hérité d'un ancien produit (« enchérir », « Buy now »), pluriels qui
  donnaient « 1 offres » ou « 1 days ago », et passages où les deux langues ne
  disaient pas la même chose. Une même chose porte désormais le même nom d'un
  écran à l'autre.
- **Les notifications sont en français partout.** « New offer received »,
  « Delivery in transit », les avis de retrait et une douzaine d'autres étaient
  écrits en anglais quelle que soit votre langue ; ils se lisent maintenant comme
  les e-mails que vous recevez déjà.
- **Les dates suivent la langue que vous avez choisie**, et non celle de votre
  navigateur, sur les livraisons, les messages, les documents et les incidents.
  Une erreur affiche désormais une phrase qui dit quoi faire, jamais un code.
- **Les écrans de connexion, d'inscription et de mot de passe ont été
  redessinés** : une seule mise en page simple, le formulaire sur la page et une
  photographie à côté, identique sur les six écrans.
- **L'en-tête du site garde deux portes**, « Connexion » et « Inscription ».
  « Devenir transporteur » figure maintenant parmi les liens de l'en-tête et dans
  le menu.
- **Une nouvelle section sur la page d'accueil, « Dans l'application »**, suit un
  transport en huit étapes — la demande, les offres, le choix, les messages, les
  photos, le suivi, le reçu et les gains, et les vérifications de notre équipe —
  sur de vrais écrans de l'application, sur ordinateur et sur téléphone. Les noms
  qui y figurent sont fictifs.
- **Un seul jeu de couleurs de statut partout.** « En attente », « En cours de
  livraison », « Livrée », « Annulée » et tous les autres statuts portent
  désormais la même couleur sur chaque écran, lisible en clair comme en sombre.
- **Des pages plus nettes** : la bande vide sous les titres de carte d'une
  demande et d'une livraison a disparu, les notifications sont de simples cartes,
  et chaque page du site a son propre titre dans l'onglet du navigateur — y
  compris une page pour une adresse qui n'existe pas.

## [2.97.0] - 2026-11-25 · ux

Une nouvelle page d'accueil : la même carte de recherche, une page plus calme et plus complète autour.

- **Une route qui défile derrière la recherche.** Le haut de la page d'accueil
  montre désormais une courte vidéo muette d'autoroute sous notre bleu, avec la
  même carte de recherche à quatre champs et le même bouton « Obtenir des
  offres ». Sur une connexion lente, avec les animations réduites ou l'économie
  de données activées, une image fixe s'affiche à la place.
- **Une barre de menu flottante.** Elle se pose sur le haut de la page et
  devient pleine quand vous faites défiler. Le bouton à trois traits ouvre un
  menu plein écran avec chaque section, le formulaire de demande, l'aide, le
  contact, la connexion et les choix de langue et de couleurs.
- **Un défilement plus fluide** sur la page d'accueil à la souris ou au pavé
  tactile, et des sections qui apparaissent en douceur. Rien ne bouge si votre
  appareil demande de réduire les animations.
- **Ce que nous transportons**, en quatre onglets — colis et objets, meubles et
  électroménager, déménagements, France et étranger — chacun avec un bouton
  pour commencer.
- **Le fonctionnement en trois étapes**, **nos quatre engagements**, une section
  pour les transporteurs et **les réponses aux questions fréquentes**, le tout
  sur la page d'accueil.
- **Un nouveau pied de page**, avec les liens rangés selon ce que vous venez
  faire.

## [2.96.1] - 2026-11-24 · infra

Rien ne change sur le site en ligne. Le site de test se comporte désormais
comme le vrai pour les paiements et les tâches planifiées, sans toucher à
l'argent réel.

- **Les paiements de test sur le site de test lui sont confirmés en retour**,
  comme les vrais paiements le sont sur le site en ligne. Ils passent par le
  mode test de Stripe : aucune carte n'est jamais débitée.
- **Les tâches planifiées du site de test peuvent être lancées à la demande**
  — clôture des demandes expirées, publication des demandes programmées,
  contrôle des documents — tandis que le site lui-même reste réservé à
  l'équipe.

## [2.96.0] - 2026-11-24 · feat

Les derniers points ouverts du 19 novembre : un code pour confirmer votre adresse, des couleurs que vous choisissez, un menu qui répond tout de suite et une nouvelle page d'accueil.

- **Un code pour confirmer votre adresse.** L'e-mail de confirmation contient
  désormais un code à 6 chiffres au-dessus du bouton. Saisissez-le sur la page
  « Vérifiez votre email » — pratique quand l'e-mail s'ouvre sur votre téléphone
  et que vous vous êtes inscrit sur votre ordinateur. Le lien fonctionne
  toujours.
- **Les e-mails partent de no-reply@expeditop.fr**, l'adresse du site.
- **Des comptes mieux protégés.** Si quelqu'un s'est inscrit avec votre adresse
  sans jamais la confirmer, vous connecter avec Google supprime désormais le mot
  de passe qu'il avait choisi. Réinitialiser votre mot de passe confirme aussi
  votre adresse et déconnecte vos autres appareils.
- **Les problèmes de connexion avec Google sont expliqués en français** sur la
  page de connexion, y compris un compte suspendu, au lieu d'une page d'erreur
  en anglais.
- **Les couleurs ne changent que si vous le choisissez.** Le site reste clair
  sauf si vous choisissez Sombre dans l'application — le mode sombre de votre
  téléphone ou de votre navigateur ne le change plus, et les navigateurs qui
  assombrissent les pages d'eux-mêmes le laissent tel quel.
- **Le menu répond tout de suite.** Le menu et la barre du bas s'affichent avec
  la page et fonctionnent dès le premier appui, même pendant le chargement.
- **Une nouvelle page d'accueil.** Indiquez le départ, la destination, la date
  et ce que vous envoyez — « Obtenir des offres » ouvre le formulaire de demande
  déjà rempli. La page montre aussi les demandes récentes, le fonctionnement en
  trois étapes, et ce qui change pour vous selon que vous expédiez ou
  transportez.

## [2.95.1] - 2026-11-24 · infra

Rien ne change sur le site en ligne. Chaque modification est désormais essayée
d'abord sur le site de test, et ne vous parvient qu'après y avoir réussi.

- **Le site de test, dev.expeditop.fr, est ouvert à l'équipe.** Il tourne sur sa
  propre base de données — une copie de la vraie, dont chaque nom, e-mail,
  numéro de téléphone, adresse et document a été retiré — avec son propre
  stockage de fichiers et Stripe en mode test : rien de ce qu'on y fait ne peut
  atteindre un vrai transporteur, une vraie demande ou un vrai paiement.
- **Une modification n'arrive sur le site en ligne qu'après avoir tourné sur le
  site de test et passé tous les contrôles automatiques.** Si un contrôle
  échoue, le site en ligne garde la version précédente.
- **Les mises à jour de la base de données se font d'elles-mêmes à la mise en
  ligne**, et seulement une fois ces contrôles réussis. Une mise à jour qui
  supprimerait ou renommerait des informations enregistrées est refusée, sauf
  si elle est explicitement marquée comme voulue.

## [2.95.0] - 2026-11-22 · fix

Ce que l'inventaire page par page a révélé, corrigé.

- **Les opérateurs, le support et la finance peuvent ouvrir le back-office.**
  Jusqu'ici seul un administrateur le pouvait ; les autres se voyaient proposer
  « Admin » puis étaient renvoyés à l'accueil. Chacun arrive désormais sur les
  pages que son rôle autorise, et ne voit que celles-là. Le support peut ouvrir
  et répondre à une conversation de support.
- **Un visiteur non connecté sur « Demander un transport »** est invité à se
  connecter et revient ensuite au formulaire, au lieu de remplir cinq étapes et
  d'échouer à la fin. Sur la page d'une demande, un visiteur non connecté se voit
  proposer un bouton « Connectez-vous pour faire une offre ».
- **Les notifications** s'affichent dans votre langue, nomment chaque type de
  notification et ouvrent la bonne page.
- **Les pages d'aide disent vrai.** Les numéros de téléphone inventés ont
  disparu, et les réponses décrivent ce que fait réellement la plateforme : une
  demande, des offres, votre choix, le paiement à l'acceptation, des photos au
  retrait et à la livraison.
- **Les avis** se classent « En tant que demandeur » et « En tant que
  transporteur » ; les boutons « Utile » et « Signaler », qui ne faisaient
  rien, ont disparu.
- **« Confirmer la livraison »** remplace « Marquer livrée sans photo » : une
  livraison exige toujours sa photo, et le bouton le dit désormais.
- **Supprimer une conversation** dispose d'un bouton sur ordinateur, et non plus
  seulement d'un balayage.
- **Les notifications « Compte & Sécurité »** s'affichent comme toujours
  actives, avec la raison, au lieu d'un interrupteur qui ne faisait rien.
- **Un devis payé livré à l'étranger** peut être publié même quand le pays n'a
  pas de code postal de 4 à 6 chiffres (par exemple « SW1A 1AA »).
- **Se connecter vous ramène** à la page que vous vouliez ouvrir, comme le
  formulaire de demande ou une demande sur laquelle vous vouliez faire une offre,
  au lieu de la page d'accueil.
- **« Supprimer mon compte »** dit désormais ce qui se passe : il ouvre un
  message à l'équipe, qui supprime le compte après vérification. Le bouton de
  confirmation se fermait et ne supprimait rien.
- L'en-tête et le pied de page ne renvoient plus vers des sections qui
  n'existent pas.

## [2.94.0] - 2026-11-22 · feat

Les retours du client du 19 novembre, les points restés ouverts.

- **Devenir chauffeur commence par un choix.** Le dossier s'ouvre sur deux
  options : « Particulier — chauffeur interne Expeditop » (un formulaire court,
  sans société ni documents) ou « Professionnel — transporteur ». Un chauffeur
  interne reste validé par une personne d'Expeditop, et il en est informé.
- **Les chauffeurs sont félicités quand leur dossier est approuvé**, par e-mail
  et dans l'application, en français, avec un bouton vers leur espace de travail.
- **Les professionnels étrangers peuvent s'inscrire.** Un numéro d'entreprise
  qui n'est pas un SIRET, un numéro de téléphone, un code postal, un numéro de
  TVA et une plaque d'immatriculation étrangers sont tous acceptés.
- **Opérateurs : le type de chauffeur passe en premier.** L'e-mail d'alerte
  d'un nouveau dossier indique « Particulier (interne) » ou « Professionnel »
  dans son objet et ouvre directement le dossier ; la page des chauffeurs
  emploie les deux mêmes mots.
- **Tous les pays du monde** peuvent être choisis pour un retrait ou une
  livraison, dans une liste où l'on peut chercher. Hors des quatorze pays
  habituels, le code postal est facultatif.
- **Une seule recherche sur le tableau des missions** : ville de départ,
  destination, date et « Titre de l'annonce », avec un bouton « Rechercher ».
  Un départ seul cherche autour de lui ; avec une destination, la recherche suit
  votre trajet.
- **Les messages affichent le pseudo.** Une personne qui a choisi un pseudo
  apparaît sous ce nom dans la liste des conversations ; la page d'inscription
  le précise désormais. Vous pouvez chercher une conversation par pseudo.
- **Texte plus grand sur téléphone et tablette.** Tout est un peu plus grand en
  dessous de la taille d'une fenêtre d'ordinateur portable.
- **Une feuille de toutes les pages et actions**, par rôle, chacune avec une
  référence à citer pour demander une modification.

## [2.93.0] - 2026-11-21 · ux

L'historique des versions se lit désormais en français, et en entier.

- **L'historique des versions est en français.** Quand le site est en français,
  « Ce qui a changé » affiche chaque version en français, de la première à la
  dernière ; en anglais, il reste en anglais. À partir de maintenant, chaque
  nouvelle version est rédigée dans les deux langues avant sa mise en ligne.
- **Chaque élément s'affiche en entier.** La page coupait chaque élément à la fin
  de sa première ligne, laissant des phrases inachevées. Elles se lisent
  désormais jusqu'au bout, et chaque version s'ouvre sur son résumé d'une ligne.

## [2.92.0] - 2026-11-21 · feat

Suite des retours du client du 19 novembre.

- **Une barre latérale sur ordinateur portable.** À partir d'une fenêtre de
  1 024 px de large, le menu devient une colonne étroite d'icônes à gauche, avec
  un bouton à trois traits en haut pour l'ouvrir en entier ; votre choix est
  mémorisé. Les téléphones et les tablettes gardent la barre du bas.
- **La barre du bas répond tout de suite.** Le bouton que vous touchez s'allume
  immédiatement et un second appui dessus ne fait rien, au lieu de donner
  l'impression de vous ignorer. Les pages affichent un écran de chargement
  pendant leur ouverture. Les notifications apparaissent désormais en haut sur
  téléphone, elles ne masquent donc plus la barre.
- **Des messages classés selon l'état de la demande.** Filtrez vos conversations
  par « En attente de transporteur », « En cours », « Terminées » ou « Sans
  annonce », chacune avec son compteur. La liste des conversations affiche les
  initiales dans la pastille ronde et prend moins de place par ligne.
- **Le premier écran du site.** Sur téléphone, l'en-tête propose
  « Connexion / Inscription » là où il n'y avait que « Devenir transporteur » ;
  sur un écran plus large, « Inscription » se place à côté de « Connexion ».
- **Les problèmes de connexion expliqués en français.** Un mauvais mot de passe,
  un e-mail déjà enregistré, un compte suspendu, trop de tentatives ou une
  connexion perdue vous disent chacun quoi faire ensuite, au lieu d'un message
  en anglais. L'écran « Vérifiez votre email » connaît désormais déjà votre
  adresse.
- **Une demande pour « un jour précis, à n'importe quelle heure »** reçoit des
  offres jusqu'à la fin de la plage d'enlèvement de ce jour, et non avant le
  début de la journée.
- La barre du bas du panneau d'administration a les mêmes libellés agrandis que
  les autres.

## [2.91.1] - 2026-11-21 · infra

Rien ne change pour vous sur le site en ligne. Cette version prépare un site de
test distinct, `dev.expeditop.fr`, où l'équipe peut essayer des changements et
chercher des bugs sans aucun risque pour les vrais chauffeurs, demandes ou
paiements.

- Le site de test a sa propre base de données, son propre stockage de fichiers,
  ses propres secrets de connexion et Stripe en mode test, et ne peut ni lire
  ni modifier ceux du site réel.
- Chaque page du site de test porte un petit onglet « Dev » et demande aux
  moteurs de recherche de ne pas la référencer.
- Le rafraîchissement des données de test copie les données réelles après avoir
  retiré tous les noms, e-mails, numéros de téléphone, adresses et documents.

## [2.91.0] - 2026-11-20 · feat

Les retours du client du 19 novembre, les points qui n'attendaient la réponse de
personne.

- **La connexion.** « Pas encore de compte ? S'inscrire » se trouve désormais en
  haut de la page de connexion, sous le titre, sans avoir à faire défiler. La
  page d'inscription explique à quoi sert un compte : demander un transport tout
  de suite, et candidater pour conduire depuis l'application.
- **L'e-mail de confirmation peut être renvoyé.** La page « Vérifiez votre
  email » a un bouton « Renvoyer l'email » et indique clairement quand un envoi
  échoue. Se connecter avec une adresse pas encore confirmée vous amène sur
  cette page et envoie un nouveau lien, au lieu d'une erreur en anglais.
  L'e-mail est en français.
- **Un e-mail de bienvenue** arrive une fois votre adresse confirmée.
- **L'assistant lit vos dates.** « Enlèvement le 20, livraison le 22 » remplit
  désormais les dates de votre demande. Si une lecture échoue, votre phrase est
  conservée et vous pouvez réessayer ; il n'attend plus indéfiniment.
- **Votre poids reste votre poids.** Choisir un titre suggéré ne remplace plus
  le poids ou la taille que vous aviez déjà choisis : une demande publiée avec
  « 5 – 30 kg » pouvait afficher 100 kg.
- **« N'importe quand » sur une date précise**, à l'enlèvement comme à la
  livraison : ce jour-là, à n'importe quelle heure.
- Les libellés des adresses d'enlèvement et de livraison sont plus grands et
  plus gras.
- **Chauffeurs : des villes hors de France.** La recherche sur le tableau des
  missions et dans le planificateur trouve Bruxelles, Genève, Turin et tous les
  pays que nous desservons.
- **Chauffeurs : « Mes offres » indique de quelle mission il s'agit.** Chaque
  offre affiche le titre, la référence, les villes et les dates demandées.
- **Les messages nomment la demande.** Chaque conversation affiche les villes et
  les dates, et à l'intérieur d'une conversation la demande reste en haut de
  l'écran pendant que vous faites défiler.
- **Après une offre refusée, une suite possible.** La personne qui a refusé peut
  proposer un autre prix ; le transporteur est prévenu, et peut se retirer et
  envoyer un nouveau prix en un seul geste.
- **Vos demandes dans la barre du bas** sur téléphone, à la place de « Devenir
  chauffeur », qui se trouve désormais sous le badge d'accès en haut et sur
  votre profil. Les libellés de la barre sont plus grands et ne sont plus
  coupés.
- Sur la page d'une demande, le titre n'est plus coupé et affiche les villes et
  la date d'enlèvement.
- **Anciens iPhone.** Le bouton sélectionné de la barre du bas s'affichait comme
  un bloc noir sans libellé, et des badges colorés pouvaient être illisibles.
  Les deux sont corrigés pour ces téléphones ; nous n'avons pas pu tester sur
  l'un d'eux, dites-nous donc ce que vous voyez.
- **Opérateurs : « Message » fonctionne.** Depuis le profil d'un utilisateur
  dans le panneau d'administration, le bouton ouvre désormais la conversation ;
  il vous ramenait auparavant au panneau.
- **Opérateurs : « Demandes et messages ».** Depuis la liste des utilisateurs,
  consultez en lecture seule les demandes qu'une personne a publiées, les offres
  qu'elle a faites et ses conversations.

## [2.90.2] - 2026-11-20 · ux

- **La plateforme s'appelle désormais EXPEDITOP.** Le nom change partout où vous
  le lisez : le titre des pages, le logo et l'invitation à installer
  l'application, chaque écran en français et en anglais, les mentions légales,
  les conditions et la politique de confidentialité, les reçus PDF et le texte
  de chaque e-mail. L'adresse `www.expeditop.fr` et le nom concordent
  désormais.
- **Les e-mails viennent d'« Expeditop ».** Les messages sont envoyés depuis
  `no-reply@expeditop.fr` : l'expéditeur que vous voyez porte donc le même nom et
  le même domaine que le site.
- Votre compte, vos demandes, vos offres et vos préférences ne changent pas :
  seul le nom a bougé.

## [2.90.1] - 2026-11-20 · infra

- **EXPEDITOO vit désormais sur www.expeditop.fr.** L'adresse est la nôtre : les
  liens des e-mails et des notifications (reçus, suivi des transports, offres,
  versements, message de bienvenue, lien de confirmation envoyé à un client)
  s'ouvrent à cet endroit, et expeditop.fr vous mène au même endroit. La
  connexion fonctionne depuis la nouvelle adresse ; il vous sera donc demandé de
  vous reconnecter une fois.
- **Les adresses de contact suivent le domaine.** Support, chauffeurs,
  transporteurs, confidentialité et facturation s'écrivent désormais
  `…@expeditop.fr` sur les pages d'aide, la page de contact, les mentions
  légales, les conditions et la politique de confidentialité, en français et en
  anglais.
- **Un lien ne peut plus mener vers le site de quelqu'un d'autre.** Quand
  l'adresse de l'application n'était pas configurée, les liens des e-mails se
  rabattaient sur un domaine qui n'a jamais été le nôtre ; ils se rabattent
  désormais sur expeditop.fr.

## [2.90.0] - 2026-11-17 · ux

- **La page d'aide des chauffeurs est en français.** « Assistance chauffeur » :
  l'équipe des opérations, la carte de la ligne d'urgence, et quatre réponses :
  comment vous êtes payé, que faire quand le destinataire est absent, comment
  prendre une nouvelle mission (et que les chauffeurs internes se voient confier
  des courses au lieu de faire des offres), et comment mettre à jour votre
  véhicule. Elle nomme désormais les vraies entrées du menu (« Missions »,
  « Mes gains », « Mon dossier »).
- **L'inscription et la réinitialisation du mot de passe parlent votre
  langue.** La page de vérification de l'e-mail (en attente, vérification en
  cours, vérifié, échec), l'écran « Check your email » après une demande de
  réinitialisation et ses messages de validation sont traduits. L'écran
  « vérifié » ne promet plus « Go to Dashboard » : il vous emmène vers votre
  compte, et le dit.
- **Un écran de plantage lisible.** Si toute la page se casse, le message et le
  bouton « Réessayer » suivent désormais la langue de votre navigateur.
- **Le dossier d'un chauffeur montre les courses en cours**, et retirer un
  chauffeur vous avertit avant que vous ne cliquiez, au lieu de refuser après
  coup.
- **Un chauffeur interne ne peut plus proposer un prix depuis une
  conversation.** Le bouton de devis n'apparaît plus pour lui dans la
  conversation d'une mission, et une demande envoyée malgré tout est refusée.
  On lui confie du travail, il ne fait pas d'offres.
- **Des petites choses qui étaient en anglais :** les notifications quand un
  remboursement est traité, qu'un avis est publié ou que des réglages sont
  enregistrés ; la notification « impossible d'ouvrir la conversation » ; la
  page des annonces de l'administration propose maintenant « Réessayer »
  quand elle ne se charge pas ; la barre de menu de l'administration et la
  ligne « coordonnées manquantes » de la carte des transports.

## [2.89.0] - 2026-11-17 · ux

- **« Faire une offre » se place désormais sur la même ligne que les badges de
  la carte.** Sur tablette et ordinateur, les badges (« Immédiat », « Urgent »…)
  et la taille (« L ») sont ensemble à gauche et le bouton est à droite, au lieu
  que le bouton passe en dessous. Sur téléphone, ou quand la ligne est trop
  serrée, le bouton prend sa propre ligne sur toute la largeur.
- **Le menu flottant ne couvre plus la dernière mission.** Sur tablette et sur
  un petit ordinateur portable, la barre du bas cachait la dernière carte et son
  bouton « Faire une offre », ainsi que les crédits de la carte. La liste et la
  carte s'arrêtent maintenant au-dessus.
- **Cinq messages du tableau des missions s'affichaient sous forme de code**
  (« jobBoard.modeNotice » et « jobBoard.modeNoticeAction ») : le rappel du mode
  Chauffeur, l'avis « candidature en attente » et son bouton, et le bouton « Voir
  la demande » de l'alerte de nouvelle mission. Ils se lisent de nouveau comme
  des phrases, en français et en anglais.
- **Certains libellés de l'application étaient encore en anglais pour les
  utilisateurs français.** La cloche des notifications (titre, « Tout marquer
  comme lu », messages non lus, « Voir toutes les notifications », l'état vide),
  le sélecteur de thème (Clair / Sombre / Comme mon appareil), le badge de
  vérification et le résultat vide d'un tableau d'administration sont traduits,
  et disent ce que fait un appui dessus.

## [2.88.0] - 2026-11-17 · ux

- **La page des chauffeurs montre d'abord qui a besoin de vous.** Elle s'ouvre
  sur « À examiner » (ou « Actifs » quand rien n'attend), avec des onglets
  Actifs, Absents ou suspendus, Clôturés et Non envoyés, et un compteur sur
  chacun. Vous pouvez aussi filtrer par type de chauffeur (interne ou externe)
  et par « Pas encore joints ».
- **Chaque dossier de chauffeur s'ouvre sur la personne, pas sur l'entreprise.**
  La liste commence par le nom du chauffeur, puis son statut et son type, et
  montre l'état du contact et le nombre de documents validés (« 2/3 »). Le
  dossier d'un chauffeur actif affiche les courses terminées, la note et les
  véhicules ; celui d'un chauffeur interne n'affiche plus de coordonnées
  bancaires qu'il n'a pas.
- **Plus de boutons tronqués dans le dossier d'un chauffeur.** Le pied de page
  n'affiche que ce qui a du sens pour l'état du chauffeur (Approuver et Refuser
  pour une nouvelle candidature, Mettre fin à l'absence ou Réactiver selon le
  cas), et tout le reste se trouve sous « Plus d'actions ».
- **Chaque action grave dit maintenant ce qu'elle fait avant que vous ne la
  confirmiez.** Suspendre bloque les nouvelles offres et courses, laisse les
  courses en cours se terminer, et peut être annulé. Retirer un chauffeur
  (« Désinscrire ») retire ses offres en attente, laisse payables les
  versements déjà acquis, est refusé tant qu'une course est en cours, et lui
  permet de candidater à nouveau.
- **« Candidat joint » est désormais clairement une note.** Elle indique que
  quelqu'un a parlé au candidat et n'approuve jamais rien ; elle ne s'affiche
  que tant qu'une candidature attend une décision.
- **« Rétablir l'accès chauffeur » a disparu pour les chauffeurs en règle.** Un
  chauffeur approuvé dont le compte n'a réellement pas le rôle chauffeur
  reçoit maintenant un avertissement avec « Réparer l'accès » ; les autres ne
  voient rien. Un chauffeur refusé ou retiré est approuvé de nouveau avec
  « Approuver quand même » / « Réactiver le chauffeur ».

## [2.87.0] - 2026-11-17 · feat

- **Il y a désormais deux sortes de chauffeur, avec deux rôles distincts.** Un
  **chauffeur interne** conduit pour Expeditoo lui-même : on lui confie les
  courses, il ne répond pas aux annonces, et il ne voit jamais de prix. Un
  **transporteur** est un chauffeur extérieur qui a passé toute la candidature :
  il répond aux annonces et il est payé. Jusqu'ici les deux rôles allaient
  ensemble ; chaque personne reçoit maintenant uniquement celui qui lui
  correspond. Les comptes approuvés avant cela gardent ce qu'ils ont.
- **Devenir chauffeur : une case à cocher pour un chauffeur interne.** Dans la
  candidature de chauffeur, « Je suis chauffeur interne Expeditoo » remplace les
  questions sur l'entreprise par un simple numéro de téléphone et une adresse :
  ni entreprise, ni SIRET, ni documents. Un administrateur approuve toujours le
  dossier.
- **Ajouter un chauffeur interne depuis l'administration, inscrit ou non.** Le
  formulaire ne demande plus d'entreprise, de SIRET ni de forme juridique. Vous
  choisissez entre quelqu'un qui a déjà un compte (transformé en chauffeur,
  rien n'est envoyé) et quelqu'un qui n'en a pas (un compte est créé et la
  personne reçoit un e-mail l'invitant à choisir son mot de passe).
- **« Gérer le rôle » peut maintenant ajouter un chauffeur interne ou un
  transporteur.** La personne apparaît immédiatement dans la liste des
  chauffeurs avec le bon rôle. Si elle avait une candidature en attente, celle-ci
  est approuvée en même temps.
- **Un administrateur peut terminer le dossier d'un chauffeur à sa place.**
  « Compléter le dossier », sur n'importe quel dossier de chauffeur, permet de
  renseigner les coordonnées et l'entreprise, de changer le type tant que le
  dossier n'est pas approuvé, et d'ajouter un véhicule : une candidature en
  attente n'a donc plus à dépendre de la personne. Les documents et les
  coordonnées bancaires restent de son ressort.
- Sur la page d'une mission, on indique à un chauffeur interne que ses courses
  lui sont attribuées au lieu de l'inviter à postuler. Dans la liste « assigner
  un chauffeur », les chauffeurs internes apparaissent par leur nom.

## [2.86.0] - 2026-11-16 · feat

- **Vous pouvez maintenant décrire votre demande en une phrase et le formulaire
  se remplit tout seul.** En haut de « Demander un transport », tapez ou dictez
  ce que vous devez déplacer, d'où et vers où — « un canapé 3 places de Lyon à
  Bordeaux » — et on vous montre ce qui a été compris : l'objet, sa taille, son
  poids, la ville d'enlèvement et la ville de livraison. « Remplir le
  formulaire » met tout dans le formulaire.
- **S'il manque quelque chose, on vous le demande.** Dites seulement « un canapé
  à prendre à Lyon » et la boîte demande vers quelle ville il va ; votre réponse
  s'ajoute à ce que vous avez déjà dit.
- **Rien n'est publié à votre place.** L'assistant ne fait que remplir le
  formulaire. Vous vérifiez toujours chaque étape — dates, adresses, budget — et
  vous appuyez vous-même sur « Publier ». La taille et le poids sont des
  estimations que vous pouvez corriger, et le code postal est celui du centre de
  la ville tant que vous n'indiquez pas le vôtre.
- **Une ville d'un pays que nous ne desservons pas encore est signalée comme
  telle**, au lieu d'être mise à tort dans le formulaire.
- La boîte apparaît pour les clients connectés sur une nouvelle demande. Votre
  texte ou votre dictée est lu par un service d'intelligence artificielle
  (OpenAI) ; la page de confidentialité l'indique désormais.

## [2.85.0] - 2026-11-16 · ux

- **Un administrateur voit désormais qui a candidaté pour devenir chauffeur,
  directement dans la liste des utilisateurs.** Jusqu'ici, une personne qui
  avait candidaté avait une cellule « Rôle » vide et rien n'indiquait qu'elle
  attendait. Elle porte maintenant une étiquette orange « Candidature chauffeur
  · à examiner » (ou « Dossier chauffeur non envoyé » si elle l'a commencé sans
  jamais l'envoyer), et un clic dessus ouvre les candidatures. L'onglet
  « Dossiers » indique combien attendent, et le statut de chaque dossier est
  maintenant la troisième colonne, ce qui évite qu'il soit caché hors de
  l'écran d'une tablette.
- **« Chauffeur » ne peut plus être attribué depuis la liste des rôles.** Cela
  créait un chauffeur sans dossier et sans vérifications. L'accès chauffeur ne
  vient désormais que de l'approbation d'une candidature, et la fenêtre des
  rôles le dit et renvoie vers elle.
- **Un chauffeur trouve maintenant où envoyer un prix.** Chaque demande du
  tableau des missions a un bouton « Faire une offre » qui mène directement au
  formulaire d'offre, et sur tablette ou téléphone un bouton « Faire une offre »
  reste à l'écran tant que le formulaire est hors de vue. La personne qui a
  publié une demande est informée de la raison pour laquelle elle ne peut pas y
  répondre par une offre, et un opérateur ou un administrateur sans compte
  chauffeur est informé de la raison pour laquelle il n'y a pas de formulaire,
  au lieu d'un espace vide.

## [2.84.1] - 2026-11-15 · fix

- **Vous recevez maintenant aussi un e-mail quand un chauffeur vous envoie un
  devis depuis la page de votre demande.** L'e-mail arrive comme n'importe quel
  autre message de chauffeur. Auparavant, un devis envoyé ainsi faisait seulement
  sonner la cloche dans l'application : vous ne saviez rien tant que
  l'application était fermée.

## [2.84.0] - 2026-11-14 · feat

- **Vous recevez maintenant un e-mail quand un chauffeur vous écrit.** Il nomme
  votre demande et renvoie vers la conversation. Si un chauffeur envoie
  plusieurs messages à la suite, vous recevez un seul e-mail, pas un par
  message. L'e-mail ne reprend jamais ce que le chauffeur a écrit.

## [2.83.2] - 2026-11-14 · fix

- **Les villes d'enlèvement et de livraison s'affichent maintenant sur la course
  en cours de l'écran d'accueil, ainsi que dans vos listes de livraisons et de
  chauffeurs.** Elles n'affichaient que la rue, et rien du tout quand aucune rue
  n'avait été indiquée.
- **Une demande publiée sans rue de livraison ne dit plus que l'adresse est
  « partagée avec les transporteurs vérifiés ».** Elle indique qu'aucune adresse
  exacte n'a été donnée et, sur votre propre demande ouverte, que vous pouvez
  l'ajouter avec « Modifier ».
- **Un chauffeur voit maintenant les villes, les étages et l'ascenseur d'une
  course** sur la page de la course, et la ligne « Livraison à » de l'e-mail de
  suivi ne commence plus par une virgule parasite.

## [2.81.0] - 2026-11-07 · ux

- **Menu d'administration : « Driver applications » n'existe plus comme entrée
  séparée.** La même liste était déjà un onglet dans Chauffeurs. Chauffeurs
  affiche maintenant un seul badge pour les candidatures à examiner et les
  documents sur le point d'expirer réunis, et l'ancien lien (dans les e-mails et
  les notifications) arrive toujours sur le bon onglet.
- **Le menu d'administration est regroupé** — Opérations, Personnes, Argent,
  Qualité, Système — au lieu d'une longue liste.
- **Sur téléphone, un administrateur peut enfin ouvrir Attributions, Retraits et
  Incidents.** La barre du téléphone ne les avait pas ; elle montre maintenant
  exactement les mêmes pages que la barre latérale.
- **Menu chauffeur, regroupé** en Missions, Argent et Compte. « Mon dossier »
  n'apparaît que tant que le dossier n'est pas approuvé (en examen, refusé,
  suspendu ou désinscrit) ; une fois approuvé, il se trouve dans le Profil sous
  « Mon dossier chauffeur ».
- **Menu demandeur, regroupé** autour de l'envoi : Demander un transport, Mes
  demandes, Suivi. Le tableau des missions n'est plus proposé à quelqu'un qui ne
  peut pas y faire d'offre, mais reste disponible pour les candidats et les
  chauffeurs.
- Le statut d'un chauffeur désinscrit affiche maintenant « Désinscrit » au lieu
  d'un blanc.

## [2.83.1] - 2026-11-12 · fix

- **Un devis envoyé depuis une mission apparaît maintenant dans Messages.** Le
  prix, le jour d'enlèvement et le véhicule apparaissent sous forme de carte
  d'offre dans la conversation avec la personne qui a publié la mission, pour
  que tous deux puissent en parler. Auparavant, seul un devis saisi dans la
  conversation créait une carte.
- **Un devis qui propose plusieurs jours le dit.** Le demandeur est envoyé sur la
  mission pour choisir un jour, au lieu d'accepter à l'aveugle depuis le
  message.
- **« En attente » dit à qui revient la réponse.** Un devis envoyé se lit
  maintenant « En attente de la réponse du demandeur, qui choisit et valide
  l'offre ». C'est le demandeur qui décide, pas une validation d'Expeditoo.
- **Le message « Offre envoyée » renvoyait au mauvais endroit.** Il indique
  maintenant que le devis se trouve dans « Mes offres » et dans les messages.

## [2.83.0] - 2026-11-11 · feat

- **Un chauffeur peut déclarer un trajet avec seulement des villes et des
  dates.** Le formulaire de trajet n'attend plus une adresse postale et un
  repère sur la carte : la ville, le code postal et les jours suffisent, et le
  formulaire dit ce qui manque encore au lieu de rester grisé. Le repère est
  trouvé à partir du code postal et de la ville.
- **Les candidats savent quels documents manquent.** À l'envoi d'un dossier de
  chauffeur, un candidat à qui il manque des documents obligatoires reçoit un
  e-mail (en français et en anglais) et une notification qui les nomment ; un
  dossier complet n'en reçoit aucun.
- **Des heures précises sur une demande.** À l'enlèvement et à la livraison, une
  demande peut maintenant aussi indiquer « de 09:00 à 12:00 », à côté du matin,
  de l'après-midi et du soir. Cela s'affiche sur la page de la mission et dans
  le formulaire d'offre. Sans heures, rien ne change.
- **« Contact confirmé » pour les candidatures de chauffeur.** Un opérateur le
  coche une fois qu'il a joint le candidat ; on voit qui et quand. Cela ne
  change pas l'approbation, qui reste une décision manuelle.
- **Une demande sans photo peut porter une illustration.** Quatre images
  génériques (meuble, colis, palette, véhicule) sont proposées, jamais
  appliquées sauf si le demandeur coche la case, et étiquetées « Illustration »
  partout où elles apparaissent.
- **Une page d'accueil plus courte et plus conviviale.** Un message et un bouton
  sur téléphone, trois étapes, deux raisons de rester, un bouton de clôture. La
  promesse « vérifié en 24 heures » a disparu.
- **Le profil en cinq parties.** Identité, Contact, Adresses, Chauffeur et
  Compte ; tous les liens existants sont toujours là. La partie Chauffeur
  n'apparaît que pour les chauffeurs et les candidats.
- **Le calendrier des offres dit pourquoi des jours sont fermés.** Il indique
  maintenant les dates entre lesquelles la demande court.

## [2.82.2] - 2026-11-07 · infra

- Rien ne change encore pour vous. Cela ajoute les outils pour terminer l'import
  des documents Airtable : une vérification de l'endroit où les fichiers
  avaient été stockés, et un moyen de les réécrire au bon endroit. Les
  documents des bordereaux s'ouvriront une fois que cela aura tourné.

## [2.82.1] - 2026-11-07 · fix

- **Les documents des bordereaux s'ouvrent sur le vrai site.** Les bordereaux
  importés pointaient vers une adresse qui n'existe que sur l'ordinateur d'un
  développeur ; ils s'ouvrent désormais toujours depuis le site en ligne.
- **Chaque ligne des bordereaux peut montrer ses documents.** « Voir les
  documents » ouvre une fenêtre avec tous les fichiers du devis — bordereau,
  factures, procurations et photos — au lieu d'une ligne sur laquelle il n'y a
  rien à cliquer.
- **Du bordereau à son devis.** Chaque ligne porte le numéro du devis (DEV-…),
  qui ouvre ce devis dans la passerelle Expedion.

## [2.82.0] - 2026-11-07 · feat

- **Tous les documents d'un devis au même endroit.** Le détail d'un devis dans
  l'administration liste maintenant le bordereau du client et, une fois l'import
  Airtable passé, le second bordereau, les factures, les procurations et les
  photos qui se trouvaient dans Airtable. L'import Airtable a été exécuté : les
  anciens bordereaux, factures et procurations se trouvent maintenant à côté des
  devis auxquels ils appartiennent.
- **Un tableau « Bordereaux » dans l'administration.** Une ligne par bordereau
  — numéro, client, e-mail, téléphone, adresse de facturation, date de vente et
  description — avec une recherche sur l'ensemble, un lien vers le document, et
  un export CSV de ce que la recherche trouve. Il remplace le tableur tenu dans
  Airtable.

## [2.80.0] - 2026-11-07 · feat

- **« Envoyer l'offre » dit pourquoi il est grisé.** Un chauffeur qui a un seul
  véhicule adapté n'a plus à ouvrir un menu pour le choisir, et le bouton
  indique maintenant ce qui manque encore — véhicule, prix ou jour — au lieu de
  simplement s'estomper.
- **« Ajouter un jour » s'explique.** Quand tous les jours qu'une demande peut
  accepter sont déjà choisis, le calendrier le dit au lieu de s'ouvrir sur
  rien à toucher.
- **Les offres au-dessus du budget se lisent simplement.** « Au-dessus du budget
  du client. C'est autorisé. » — la formulation qui faisait chercher aux
  chauffeurs un champ où se justifier a disparu.
- **Une demande peut indiquer la hauteur minimale sur le trajet** (un parking,
  un porche). Elle s'affiche sur la page de la mission pour les transporteurs.
- **La ligne de rue d'une adresse est facultative.** La ville et le code postal
  suffisent pour publier ; le repère est trouvé à partir d'eux.
- **Les écrans de téléphone sont plus calmes.** La langue, le thème, le plein
  écran, l'installation et « Un avis, un souci ? » se trouvent maintenant
  derrière un seul bouton dans la barre du haut, et la barre du bas est une
  capsule flottante et dépolie. Le profil n'est plus un onglet : c'est votre
  avatar, en haut.
- **Installez l'application et passez en plein écran.** Un bouton propose
  « Installer l'application » quand l'application n'est pas encore installée, et
  « Plein écran » là où le navigateur le permet.
- **Un aspect plus blanc et plus léger.** Le thème clair est d'un blanc pur, le
  thème sombre est moins lourd, et une première visite s'ouvre en clair.
- **Les pseudos apparaissent dans les tableaux des chauffeurs et du suivi** pour
  les opérateurs.
- **« Retour » sur Historique des transactions et sur le tableau de bord
  chauffeur.**
- **La page d'accueil annonce les nouvelles missions.** « N nouvelles courses
  dans les dernières 24 h », avec un bouton vers les missions.
- **Les chauffeurs approuvés peuvent changer de mode depuis la page d'accueil.**
  Quand vous avez l'accès chauffeur mais naviguez en tant que demandeur, le
  tableau de bord propose « Passer en mode Chauffeur » en un geste.
- **Une barre du haut plus légère sur téléphone.** Seuls le logo, les réglages
  rapides, la cloche et votre avatar restent ; le sélecteur d'accès est passé
  dans les réglages rapides, et les deux raccourcis que la barre du bas a déjà
  ont disparu du haut.
- **Le formulaire de demande pose les questions dans l'ordre Quoi, puis Quand,
  puis Où**, comme le client l'a demandé.
- **Choisissez comment donner une adresse.** À chaque extrémité, deux boutons
  clairs : « Saisir une nouvelle adresse » ou « Choisir une adresse
  enregistrée ».
- **Une offre est vérifiée avant d'être envoyée.** « Envoyer l'offre » montre le
  prix, le véhicule et les jours, et « Confirmer l'offre » l'envoie.
- **« Mes trajets » est à un geste du profil chauffeur**, où l'on ajoute, modifie
  et supprime les trajets.

## [2.79.1] - 2026-11-07 · fix

- **Un administrateur peut maintenant réparer n'importe quel compte chauffeur
  depuis l'écran.** Réactiver un chauffeur suspendu lui rend aussi l'accès
  chauffeur, de sorte que « Dossier approuvé, mais accès chauffeur inactif » ne
  peut plus être une impasse. Une candidature jamais envoyée, refusée ou
  clôturée par une désinscription peut être approuvée directement, et un compte
  approuvé qui a perdu son accès chauffeur dispose d'un bouton « Rétablir
  l'accès chauffeur ».
- **Un chauffeur suspendu peut partir.** L'option « Me désinscrire » n'était
  montrée qu'aux chauffeurs approuvés ; un chauffeur suspendu n'avait donc ni
  issue ni explication. Elle s'affiche maintenant, avec une ligne qui indique que
  le compte est suspendu.

## [2.79.0] - 2026-11-07 · feat

- **Un chauffeur peut maintenant trouver les missions.** Les chauffeurs qui
  étaient sur l'accès « Utilisateur » ne voyaient pas du tout le tableau des
  missions depuis la barre du téléphone. La barre garde maintenant « Missions »
  pour chaque chauffeur approuvé, quel que soit son accès.
- **L'accès (Chauffeur / Utilisateur / Admin) peut être changé depuis un
  téléphone.** Le sélecteur n'existait que sur un écran large. Il se trouve
  maintenant à côté du logo, à toutes les tailles.
- **Un chauffeur tout juste approuvé s'ouvre sur l'accès Chauffeur**, une seule
  fois. Un administrateur qui est aussi chauffeur s'ouvre lui aussi sur
  Chauffeur, au lieu de l'arrière-guichet sans missions. Choisir « Expédier » à
  l'inscription ne prend plus le pas sur un compte chauffeur.
- **Les candidats dont le dossier est en examen peuvent parcourir les
  missions**, avec une note leur disant qu'ils pourront faire des offres une
  fois approuvés. Les chauffeurs sur l'accès Utilisateur ont sur le tableau un
  « Passer en mode Chauffeur » en un geste.
- **Chaque chauffeur approuvé est alerté quand une nouvelle mission est mise en
  ligne** : la cloche s'allume et un avis apparaît à l'écran avec un bouton qui
  ouvre la mission. Les chauffeurs dont le trajet déclaré correspond à la
  mission reçoivent le même avis. La cloche se rafraîchit aussi toute seule
  chaque minute si la connexion en direct tombe.

## [2.77.1] - 2026-11-04 · fix

- **Le tableau de bord ne dit plus « This did not load » quand la vraie réponse
  est « vous n'avez pas l'accès chauffeur ».** Un compte dont la candidature
  est approuvée mais qui n'a plus le rôle chauffeur voit maintenant simplement
  l'avis « Dossier approuvé, mais accès chauffeur inactif », sans un bouton
  Réessayer qui ne pouvait jamais fonctionner.
- « Mes offres » explique que les offres sont réservées aux transporteurs
  approuvés et renvoie vers la candidature, au lieu de proposer de réessayer.
- Un refus (non autorisé, non connecté, introuvable) n'est plus envoyé deux
  fois.

## [2.77.0] - 2026-11-02 · feat

- **Plus de moyens de payer que de saisir une carte.** Quand vous acceptez une
  offre, la fenêtre de paiement propose maintenant aussi **Link**, le paiement
  rapide de Stripe, et **PayPal** dès qu'il est activé pour Expeditoo — à côté
  des champs de carte, d'Apple Pay et de Google Pay. Avec PayPal, vous validez
  le paiement sur le site de PayPal et revenez directement terminer la
  réservation ; si vous annulez là-bas, la fenêtre le dit et vous laisse
  choisir à nouveau.
- « Enregistrer cette carte » n'apparaît plus que lorsque vous payez par carte,
  puisque seule une carte peut être conservée pour la prochaine fois.
- La page « Ajouter une carte » est maintenant en français, propose Apple Pay et
  Google Pay, et vous laisse réessayer si elle ne se charge pas.

## [2.76.0] - 2026-11-02 · feat

- **Demandez un devis de déménagement.** À la première étape d'une demande,
  « Vous déménagez ? Cliquez plutôt ici ! » fait passer le formulaire en mode
  déménagement : photos, surface de votre logement en m² (ou le volume exact en
  m³ si vous le connaissez), et tout ce que les déménageurs doivent savoir. Les
  déménageurs envoient ensuite leurs offres comme pour n'importe quelle demande.
  La mission affiche partout un badge « Déménagement ».
- **Un carnet d'adresses pour chaque extrémité.** « Carnet d'adresses de
  retrait » et « Carnet d'adresses de livraison » apparaissent désormais
  toujours sur le formulaire de demande, avec vos adresses d'enlèvement listées
  en premier du côté retrait et vos adresses de livraison en premier du côté
  livraison. Une adresse enregistrée sans la placer sur la carte apparaît
  maintenant aussi ; avant, elle ne revenait jamais. La liste d'adresses de
  votre profil est triée de la même façon, avec un bouton pour en ajouter une à
  chaque extrémité.
- **Pays de retrait et de livraison.** Chaque extrémité a un champ « Pays de
  retrait » / « Pays de livraison » : la France par défaut, ou l'un de 13 pays
  voisins. La recherche d'adresse, la carte et le code postal suivent le pays
  que vous choisissez. Les transporteurs voient le pays à côté de la ville.
- **Les étages sont montrés au transporteur.** Jusqu'ici, l'étage et
  l'ascenseur que vous indiquiez étaient enregistrés mais jamais affichés sur la
  mission, de sorte qu'un transporteur ne le savait que si vous l'écriviez aussi
  dans les notes. Ils apparaissent maintenant à chaque extrémité (« 3ᵉ étage ·
  sans ascenseur »), sur la page de la mission et sur la course du chauffeur.
  Vous pouvez indiquer un étage pour une maison, un bureau, un magasin, une
  salle des ventes ou un garde-meuble, pas seulement un appartement.
  L'ascenseur est désormais un simple Oui / Non, demandé seulement à partir du
  premier étage.
- **« Ni protection ni emballage »** est un cinquième choix d'emballage, coché
  par défaut, et la mission l'indique au lieu de laisser les transporteurs
  deviner.
- **« Commissaire-priseur »** (« Auction house » en anglais) est un nouveau type
  de lieu. Les missions venant d'Expedion indiquent désormais que leur
  enlèvement se fait chez un commissaire-priseur.
- **Une estimation de prix plus claire.** La dernière étape affiche une carte
  « Estimation du prix » que vous pouvez appliquer d'un seul geste. Elle compte
  maintenant chaque objet (dix cartons étaient auparavant chiffrés comme un
  seul), et fonctionne quand une adresse a été saisie sans point sur la carte.
  En dessous, quatre étapes expliquent ce qui se passe ensuite. Les
  déménagements n'ont pas encore d'estimation automatique : les déménageurs
  font leurs offres.
- Les champs d'adresse indiquent maintenant de quelle extrémité il s'agit :
  « Adresse de retrait », « Adresse de livraison ».

## [2.75.0] - 2026-11-02 · ux

- **Plus aucun écran ne vous laisse bloqué.** Quand une action est
  impossible, l'application vous dit désormais quoi faire à la place, avec un
  bouton pour y aller.
- **Accepter une offre :** si l'offre ne peut pas être acceptée, la fenêtre
  propose maintenant la suite — choisir un autre créneau, voir les autres
  offres, voir les transporteurs qui font ce trajet, ou modifier la
  demande — au lieu d'un simple « Fermer ». Si vous aviez déjà appuyé sur
  Payer, elle précise que votre carte n'a pas été débitée.
- **Vos demandes :** une demande en ligne peut maintenant être **modifiée**
  (elle repasse en brouillon le temps de la modifier, puis vous la publiez de
  nouveau) ou **annulée**, depuis sa page ou depuis « Mes demandes ». Tout
  transporteur qui avait fait une offre en est informé. Une demande expirée,
  annulée ou livrée peut être **republiée** en un geste, sous la forme d'une
  copie que vous vérifiez avant de la publier. Une fois un transporteur
  choisi, la demande vous renvoie vers sa livraison.
- **Pas encore d'offres ?** La page de la demande mène désormais aux
  transporteurs qui font déjà ce trajet.
- **Transporteurs :** si vous avez déjà fait une offre sur une course, la
  course l'affiche, avec « Retirer mon offre », au lieu d'un second
  formulaire. Une offre refusée dit pourquoi et propose la suite — gérer vos
  disponibilités, ajouter un véhicule, voir d'autres courses. Quand aucun de
  vos véhicules ne peut transporter la charge, le formulaire d'offre le dit.
  « Mes offres » est maintenant en français.
- **Chauffeurs :** quand la marchandise est déjà en route et qu'il faut
  changer quelque chose, le message s'accompagne de « Contacter le support ».
- **Quand une page ne se charge pas**, elle le dit et propose « Réessayer » —
  messages, notifications, livraisons, vos demandes, la page d'accueil, votre
  candidature, votre flotte et les files d'attente de l'administration.
  Avant, certaines affichaient une page blanche, « rien ici » ou un formulaire
  vide.
- Les pages vides indiquent maintenant d'où viendra la suite : demander un
  transport, voir les courses disponibles, devenir chauffeur, ou tout
  réafficher après un filtre.

## [2.73.1] - 2026-10-31 · fix

- Sur la vue carte de « Mes demandes », la demande que vous sélectionnez
  affiche maintenant son prix au premier plan. Avant, quand deux de vos
  demandes partaient de la même ville, le prix de l'autre pouvait le
  recouvrir.

## [2.73.0] - 2026-10-31 · fix

- **Choisir un transporteur n'est plus bloqué quand une demande n'a pas de
  point sur la carte.** Si l'adresse de retrait ou de livraison a été saisie
  sans être placée sur la carte, l'application la retrouve maintenant à partir
  de l'adresse — ou au moins de la ville — et le paiement passe. Les nouvelles
  demandes reçoivent leur point sur la carte dès leur publication. Seule une
  adresse introuvable demande encore à être corrigée.

## [2.72.0] - 2026-10-31 · infra

- Rien ne change à l'écran, hormis une ligne sous le résultat du
  planificateur d'itinéraire qui cite OpenStreetMap, dont il utilise les
  données.
- Le service de calcul d'itinéraire du planificateur peut maintenant être
  basculé vers un fournisseur payant par un simple réglage, et le serveur ne
  tourne plus avec un indicateur d'environnement erroné.

## [2.71.0] - 2026-10-30 · feat

- **Les administrateurs peuvent suspendre la publication automatique d'un
  devis payé** depuis sa fenêtre de détail, puis la reprendre plus tard. Rien
  n'est supprimé, et « Publier » fonctionne toujours à la main.
- **Les chauffeurs reçoivent un e-mail** quand un client leur écrit au sujet
  d'une course et quand leur offre est acceptée. Les SMS suivront une fois le
  service de SMS configuré.
- **Le dossier de chaque chauffeur indique son type** : tous les chauffeurs
  sont « Professionnel » pour l'instant, et l'alerte de candidature le dit.
- Les versements aux chauffeurs restent inchangés : vous les demandez, un
  opérateur les approuve et enregistre le virement.

## [2.70.0] - 2026-10-30 · feat

- **Chauffeurs : un planificateur d'itinéraire.** « Planificateur » dans le
  menu : choisissez votre point de départ (ou utilisez votre position),
  ajoutez vos courses — chacune ajoute son retrait et sa livraison — et
  n'importe quelle ville comme étape, réorganisez-les, puis indiquez où vous
  terminez (cela peut être votre point de départ). Le trajet est calculé deux
  fois, par l'autoroute et sans, avec la distance et le temps de conduite de
  chacun, tracés sur une carte. Une livraison placée avant son propre retrait
  est signalée.

## [2.69.0] - 2026-10-30 · feat

- **Chauffeurs : un versement attend tant que le client signale un
  problème.** Si le client (ou le support) signale un dommage, une
  marchandise qui n'est pas celle décrite, un problème de sécurité ou un
  autre souci avec les biens, le paiement de cette course s'affiche « en
  attente » dans « Mes paiements » et ne peut pas être retiré tant que le
  support n'a pas traité le signalement. Vos propres signalements ne
  retiennent jamais votre paie.
- **Les chauffeurs reçoivent un e-mail pour chaque versement** : quand une
  livraison s'ajoute à ce qui vous est dû, et quand le virement est effectué,
  avec sa référence.
- **Les chauffeurs reçoivent un SMS** quand le client vous écrit au sujet
  d'une course (au plus un toutes les 30 minutes par conversation), et quand
  votre offre est acceptée. Le SMS ne contient jamais le message lui-même.
- **Les versements automatiques sont prêts, mais désactivés tant que le côté
  bancaire n'est pas en place.** Une fois les versements Stripe activés et
  votre compte de versement connecté, votre part d'une course livrée est
  envoyée sur votre compte bancaire 48 heures après la livraison si aucun
  problème n'a été signalé. D'ici là, les paiements se demandent et se
  règlent comme aujourd'hui.
- Administrateurs : dans Supervision, le choix d'une période dans « Récents »
  fonctionne — il échouait dans la version précédente avant même sa mise en
  ligne.

## [2.68.0] - 2026-10-30 · feat

- **« Mes demandes » peut s'afficher sur une carte.** Choisissez « Carte » :
  vos demandes sont listées à côté d'une carte de leurs trajets. Touchez une
  demande pour zoomer sur son retrait et sa livraison, ou touchez un prix sur
  la carte pour retrouver sa demande.
- **Chauffeurs : cherchez depuis l'endroit où vous êtes.** « Partir de ma
  position » remplit le départ à partir de la localisation de votre
  téléphone. « Retour au départ » fait de votre point de départ l'arrivée,
  pour un aller-retour.
- **La zone que vous recherchez est tracée sur la carte** — le cercle autour
  de votre ville, ou votre trajet — et un petit aperçu sous la recherche
  ouvre la carte.

## [2.67.0] - 2026-10-30 · feat

Réponses de Nicolas des 28–29 octobre, deuxième partie : choisir et
négocier.

- **Les administrateurs peuvent choisir le transporteur d'une demande
  client.** Sur une demande publiée sur le site, « Proposer au client »
  désigne une offre comme le choix d'Expeditoo. Le client la voit entourée,
  avec la mention « Choix Expeditoo » et un bouton « Payer pour confirmer » :
  rien n'est réservé et aucune carte n'est débitée tant qu'il n'a pas payé.
- **Les clients peuvent faire une contre-offre.** Sur n'importe quelle offre
  faite à leur demande, « Contre-proposition » envoie au transporteur un autre
  prix accompagné d'une courte note. Le transporteur l'accepte, garde son
  prix, ou répond avec un nouveau prix, depuis « Mes trajets ». Jusqu'à cinq
  tours par offre ; le prix que vous payez est celui de l'offre au moment où
  vous l'acceptez.
- **Un prix conseillé à la publication d'une demande.** Pour les colis que la
  plateforme sait chiffrer (jusqu'à 100 kg), l'étape du budget affiche « Prix
  conseillé » avec une fourchette et un bouton « Utiliser » en un geste.
- **Avant de payer, la fenêtre de paiement montre ce que vous réservez** : le
  créneau de retrait, la date de livraison promise par le transporteur, et les
  jours et horaires de livraison que vous avez indiqués en publiant.
- Si un transporteur change son prix pendant que vous payez, le paiement est
  refusé et on vous demande de rouvrir l'offre — vous n'êtes jamais débité
  d'un prix qui ne vous a pas été montré.

## [2.66.0] - 2026-10-29 · feat

Réponses de Nicolas des 28–29 octobre, et test terrain des chauffeurs.

- **La référence d'une course est son seul numéro, « 100018 ».** Les lettres
  de trajet affichées depuis la semaine dernière disparaissent. Une référence
  copiée avec elles retrouve toujours la course.
- **Administrateurs : les tableaux des demandes et des transports se lisent
  numéro · départ · arrivée · demandeur**, avec les initiales du demandeur à
  côté de son nom.
- **Supervision : « Récents » couvre maintenant tous les devis, et plus
  seulement les 25 derniers.** Choisissez une période et la recherche porte
  sur tous, cent à la fois. Chaque onglet a un bouton qui inverse l'ordre :
  « À traiter » s'ouvre avec les plus anciens d'abord, « Récents » avec les
  plus récents d'abord.
- **Badge « Immédiat »** : une demande ouverte dont la fenêtre de retrait a
  déjà commencé — la marchandise peut être récupérée tout de suite — porte un
  badge ambre « Immédiat », en plus de « Urgent » quand son retrait doit aussi
  avoir lieu dans les 48 heures. Une demande dont le délai pour faire une
  offre est dépassé n'affiche plus « Urgent ».
- **L'étiquette « Directe » devient « Site Expeditoo »**, pour dire d'où vient
  la demande plutôt que de ressembler à une case cochée par quelqu'un.
- **Chauffeurs : « Mes livraisons » affiche les dates de retrait et de
  livraison de chaque trajet**, prévu ou terminé, trie du plus proche au plus
  lointain ou l'inverse, et filtre par période. Les transporteurs y trouvent
  un bouton « Mes paiements », ainsi que dans « Mes trajets ».
- **Les chauffeurs peuvent indiquer qu'ils sont absents.** « Je m'absente »
  sur votre dossier de chauffeur, avec une date de retour ou jusqu'à ce que
  vous reveniez : aucune nouvelle course ne vous est proposée entre-temps,
  et les trajets déjà réservés, votre argent et vos documents restent tels
  quels. « Me désinscrire » ferme le compte dès qu'aucun trajet n'est en
  cours ; vos offres en attente sont retirées et l'argent déjà gagné vous
  reste dû.
- **Administrateurs : un chauffeur est désormais Actif, Absent, Suspendu ou
  Désinscrit.** Depuis le dossier d'un chauffeur, vous pouvez le déclarer
  absent ou de retour, le suspendre, rétablir un chauffeur suspendu, ou le
  désinscrire en indiquant un motif.
- **Les administrateurs sont prévenus quand un chauffeur dépose une
  candidature**, dans l'application et par e-mail.
- **Les clients peuvent payer avec Apple Pay ou Google Pay** au moment de
  choisir un transporteur, sur les appareils qui le proposent.

## [2.65.0] - 2026-10-24 · feat

Revue de Nicolas du 21 octobre, point par point.

- **Opérateurs : « À traiter » est maintenant toute la liste de choses à
  faire.** Elle ne regardait que les 25 devis les plus récents, si bien que la
  barre latérale affichait 48 quand l'onglet en montrait 1. Elle liste
  désormais tous les devis qui vous attendent, quel que soit leur âge, du plus
  ancien au plus récent, et dit en une ligne ce qui est compté. Le badge de la
  barre latérale compte chaque devis une seule fois — un devis payé dont le
  délai était dépassé comptait deux fois. « Tous » devient « Récents », et la
  colonne « Reçu » affiche la date et sa flèche de tri.
- **Chaque devis Expedion a un numéro à nous, « DEV-04659 »**, y compris ceux
  envoyés depuis le nouveau site, qui n'en avaient aucun et affichaient le
  numéro de lot de la maison de vente. Le numéro Airtable est affiché en
  dessous quand il y en a un, et la recherche les retrouve tous.
- **Un seul format de référence pour toutes les courses : « PAR-CLA-100018 »**
  — les lettres du départ et de l'arrivée devant le numéro, sur les pages de
  course, dans « Mes demandes », dans l'administration et dans le tableau des
  transports. Le numéro seul retrouve toujours la course.
- **Le tableau des transports nomme le chauffeur**, affiche la référence de la
  course au lieu d'un code aléatoire, et parle des statuts en français. La
  colonne « Propositions », qui affichait toujours 0, disparaît.
- **La file d'attribution montre toutes les demandes encore sans chauffeur** :
  en haut, les courses Expedion pour lesquelles vous choisissez un chauffeur ;
  en dessous, tout le reste, avec l'indication de qui décide pour chacune. Son
  badge n'affiche plus une course que vous ne pouvez pas ouvrir.
- **Les demandes urgentes le disent.** Une demande ouverte dont le retrait est
  dans moins de 48 heures porte un badge rouge « Urgent » partout où elle
  apparaît. L'ancien badge de la place de marché sur la clôture des offres
  affiche maintenant « Clôture bientôt ».
- **Sur la page d'une course, le titre, la référence, le demandeur et le prix
  restent en haut** pendant le défilement. Sur téléphone, le retrait et la
  livraison sont deux cartes entre lesquelles vous glissez.
- **Dans une conversation, chaque offre affiche le budget du demandeur à côté
  d'elle** et l'écart, au-dessus ou en dessous, du prix par rapport à ce
  budget.
- **Votre tableau de bord liste toutes vos demandes en ligne, une ligne
  chacune**, au lieu d'une grande carte pour la plus récente. « Mes demandes »
  peut s'afficher en liste, en cartes ou en détail, et retient votre choix.
- **Messages : recherchez par ville, par trajet (« Paris → Clamart ») ou par
  référence**, et vos annonces en ligne sont proposées comme filtres en un
  geste. Une annonce sans conversation vous renvoie vers les transporteurs de
  ce trajet.
- **Votre profil indique combien de demandes vous avez publiées et combien un
  transporteur en a prises** ; les administrateurs voient la même chose dans
  « Voir le profil ».
- **Chauffeurs : les confirmations et refus d'offre sont en français** (« Offre
  envoyée », « Le délai pour faire une offre … est écoulé »). Supprimer une
  conversation demande maintenant une confirmation.
- **L'e-mail et la page de réinitialisation du mot de passe sont en
  français.** Si l'e-mail ne peut pas être envoyé, la raison est désormais
  enregistrée au lieu de disparaître.
- **Administrateurs : Paramètres a une carte « Tâches planifiées »** qui
  indique quand chaque tâche automatique a tourné pour la dernière fois —
  expiration des demandes, publication des devis payés, publication des
  demandes programmées, vérification des documents des chauffeurs. Une demande
  dont le délai est passé affiche maintenant « Expirée » au lieu de
  « Ouverte ».
- **L'étiquette « Directe » s'explique** quand vous la survolez.

## [2.64.1] - 2026-10-17 · fix

- **Un client Expedion qui paie puis ferme la page est tout de même enregistré
  comme ayant payé.** Le paiement ne comptait qu'une fois le navigateur du
  client revenu sur la page de confirmation ; un client qui fermait l'onglet
  avant restait « en attente de paiement » ici. Stripe prévient maintenant
  directement cette plateforme, et le devis passe à payé dès lors que le
  montant correspond exactement au prix accepté. Un montant différent est
  signalé sur le devis pour qu'un opérateur le vérifie.
- **La nouvelle application Expedion ne dépend plus d'Airtable ni de n8n** pour
  quoi que ce soit : inscription, profil, devis, suivi, support et paiement
  passent tous par cette plateforme. L'application Expedion actuelle du
  client continue de les utiliser jusqu'à ce que la nouvelle la remplace.

## [2.64.0] - 2026-10-17 · feat

- **Les informations de votre entreprise, saisies une seule fois, dans
  l'administration.** Administration → Paramètres a une nouvelle carte
  « Informations de l'entreprise » : raison sociale, forme juridique, capital,
  siège social, SIRET, RCS, numéro et taux de TVA, e-mail de facturation,
  directeur de la publication et hébergeur. Une fois les champs légaux
  remplis, chaque document de paiement devient une **Facture** au lieu d'un
  « reçu de paiement », et la carte indique précisément quels champs manquent
  encore d'ici là. La page Mentions légales se remplit à partir des mêmes
  informations.
- **Un contrôle Stripe lisible sans développeur.** La même page indique si les
  paiements sont prêts à encaisser de l'argent réel : clés de production, compte
  Stripe autorisé à encaisser, webhook pointé vers cette application, dernier
  événement envoyé par Stripe, et premier paiement réel. Elle liste aussi les
  autres webhooks du compte Stripe, comme les automatisations de l'application
  Expedion actuelle, pour que personne ne les coupe par erreur.
- **Payer les chauffeurs : où va l'argent.** Chaque demande de versement dans
  Administration → Retraits affiche maintenant les derniers chiffres de l'IBAN
  et le BIC du chauffeur à comparer avec son RIB, ou avertit qu'il n'en a pas
  fourni. Les chauffeurs demandent toujours leur solde depuis « Mes gains » et
  le suivent de « Demandé » à « Payé ».
- **L'application Expedion peut conserver ici les coordonnées de ses
  clients.** Nom, téléphone et adresse postale ont maintenant leur place dans
  cette plateforme, prêts pour que la nouvelle application Expedion cesse de
  les envoyer à Airtable.

## [2.63.0] - 2026-10-15 · feat

- **Une demande flexible reçoit des offres jusqu'à son dernier jour
  possible.** Une demande avec un retrait « du 8 au 31 octobre » fermait aux
  offres le 8, et sa page de remerciement le disait : « jusqu'au 8 oct. ».
  Elle reste maintenant ouverte jusqu'au 31 — six heures avant la fin de la
  fenêtre — et la page de remerciement indique cette date. Les demandes à date
  précise ne changent pas.
- **« Flexible » passe en premier.** Sur « Quand », « Vos dates sont-elles
  fixes ? » démarre maintenant sur « Flexible », avec « Date précise » à côté.
  Un brouillon enregistré s'ouvre comme vous l'avez laissé.
- **« Détails » est facultatif.** Vous pouvez publier une demande sans la
  décrire au-delà de ce que vous déplacez. Les notes d'adresse s'appellent
  maintenant « Détails – conditions d'accès », pour l'étage, le code et le
  stationnement, et le chauffeur les voit sous ce nom sur le trajet.
- **Inscrivez-vous avec votre prénom et votre nom.** « Nom complet » devient
  « Prénom » et « Nom », avec un « Pseudo » facultatif. Les champs de mot de
  passe n'affichent plus une rangée de points avant que vous tapiez.
- **Vos coordonnées, et quelqu'un à appeler.** Votre profil a une carte
  « Coordonnées personnelles » : votre nom, votre pseudo et votre téléphone,
  ainsi que le nom et le téléphone d'un proche que l'équipe peut appeler si
  elle ne parvient pas à vous joindre. Seuls vous et l'équipe Expeditoo les
  voient — jamais un transporteur ni un demandeur.
- **« Historique des transactions » remplace « Mes factures ».** Vos reçus et
  factures indiquent maintenant ce qu'ils sont — « Facture », « Reçu de
  paiement » ou « Avoir ». Les transporteurs ont un second onglet avec chaque
  trajet livré : le prix, la commission de la plateforme, ce qui leur reste, si
  cela a été payé, et le relevé d'activité de la période à télécharger.
- **« Mes trajets » suit votre travail.** À côté de « Prévus », trois nouveaux
  onglets : « En attente de réponse » (les offres envoyées auxquelles personne
  n'a encore répondu, avec un moyen d'en retirer une), « En transit » (les
  trajets qui vous ont été confiés et que vous n'avez pas livrés) et
  « Terminés » (ce que montrait « Effectués »).
- **« J'ai une demande » est sous « Contact & Aide ».** Elle a quitté les
  liens rapides de votre profil et devient une carte de la page d'aide — pour
  les chauffeurs aussi.
- **La barre du bas n'est plus coupée sur iPad.** L'espace qu'un iPad réserve
  en bas de l'écran mordait sur la barre et coupait ses libellés en deux. La
  barre se place maintenant au-dessus, libellés entiers.
- **Un compte ne peut plus s'attribuer le badge « vérifié ».** S'inscrire ou
  modifier un compte permettait de définir son statut vérifié ou son compte de
  paiement depuis l'extérieur de l'application. Seule la plateforme les définit
  désormais.

## [2.62.0] - 2026-10-07 · ux

- **Votre adresse enregistrée ne remplit plus les deux extrémités d'une
  demande.** Une nouvelle demande s'ouvrait avec la même adresse enregistrée
  au retrait et à la livraison. Maintenant, le retrait est rempli à partir de
  vos adresses et la livraison s'ouvre sur « Saisir une nouvelle adresse », prête
  à être tapée — sauf si vous gardez une adresse pour les livraisons, auquel
  cas celle-ci est remplie.
- **Gardez une adresse pour les retraits ou pour les livraisons.** Dans votre
  profil, « Utiliser pour » marque une adresse comme lieu de départ ou
  d'arrivée habituel, et une adresse que vous enregistrez en publiant une
  demande retient à quelle extrémité elle a été saisie. Chaque extrémité de
  votre prochaine demande démarre avec la sienne.
- **Les adresses enregistrées sont une liste déroulante.** Sur « Où », chaque
  extrémité a une seule liste « Adresse enregistrée » au lieu d'une pile de
  cartes, avec « Saisir une nouvelle adresse » toujours en dernier. Une adresse
  déjà utilisée à l'autre extrémité le signale.
- **« Suivant » dit quand le retrait et la livraison sont à la même
  adresse.** Il refusait sans un mot. La livraison affiche maintenant « Le
  retrait et la livraison sont à la même adresse » dès que cela se produit, et
  « Suivant » l'explique aussi dans un message.
- **Les adresses affichent leur nom.** Les adresses affichaient
  `profile.address.labelPresets.home` là où elles devaient indiquer
  « Domicile ». « Domicile », « Travail », « Stockage » et « Voisin »
  s'affichent maintenant dans votre langue. Enregistrer une adresse depuis une
  demande propose les mêmes noms, et une adresse enregistrée sans nom prend
  celui de sa ville.
- **Votre profil liste toutes vos adresses.** La carte « Adresses » disait qu'il
  n'y en avait aucune sauf si l'une était votre adresse par défaut, et son
  bouton ne menait qu'à l'ajout d'une autre. Elle liste maintenant chaque
  adresse enregistrée — trois, puis « Tout afficher » — chacune ouvrant sa
  page de modification, avec « Ajouter une nouvelle adresse » et « Gérer mes
  adresses » en dessous. La page « Mes adresses » est maintenant en français
  comme en anglais.

## [2.61.0] - 2026-10-07 · ux

- **« Devenir chauffeur » s'ouvre, d'où que vous partiez.** L'option du menu
  d'accès pour ajouter l'accès chauffeur renvoyait un administrateur vers le
  panneau d'administration dès que la page apparaissait, et ne faisait rien du
  tout quand vous étiez déjà sur votre dossier. Elle ouvre maintenant d'abord
  une courte explication (vos informations, vos documents, notre examen), et
  « Commencer ma candidature » vous mène à votre dossier et le garde ouvert.
- **La barre latérale a sa propre entrée.** Sur ordinateur, une entrée verte
  « Devenir chauffeur » se place maintenant au-dessus de « Panneau
  d'administration », comme c'était déjà le cas dans la barre du bas du
  téléphone. Une fois votre candidature commencée, elle devient « Mon
  dossier » et indique où en est votre dossier : Brouillon, Envoyé, En examen,
  Approuvé, Refusé ou Suspendu.
- **Un dossier approuvé ne prétend plus à un accès que vous n'avez pas.** Si
  votre dossier est approuvé mais que l'accès chauffeur est désactivé sur
  votre compte, la page le dit et explique quoi faire, au lieu d'afficher
  « Vous êtes un chauffeur approuvé ».

## [2.60.0] - 2026-10-05 · feat

- **Terminez un brouillon depuis « Mes demandes ».** Un brouillon enregistré a
  maintenant ses propres boutons : « Publier » l'ouvre à l'étape du budget,
  prêt à être publié ; « Reprendre » l'ouvre depuis le début pour tout
  modifier ; « Supprimer » le supprime après confirmation. Les mêmes boutons
  figurent sur la page du brouillon, et la carte indique quand vous l'avez
  enregistré pour la dernière fois. Si l'horaire enregistré d'un brouillon
  n'est plus proposé par le formulaire, il s'ouvre à l'étape des dates et
  indique quel horaire il contient maintenant, pour que rien ne soit publié à
  un horaire que vous n'avez pas vu.
- **Une demande programmée peut encore changer avant sa mise en ligne.**
  « Publier maintenant », « Modifier », « Repasser en brouillon » (elle vous
  attend alors au lieu de se publier à son heure) ou « Supprimer ». La carte
  indique quand elle sera mise en ligne.
- **« Publiée le » est le jour où votre demande a réellement été mise en
  ligne**, et non celui où elle a été enregistrée pour la première fois, et
  les demandes les plus récentes arrivent en premier sur la place de marché.
  Une demande qui n'a jamais été mise en ligne indique « Créée le ».
- **Vous choisissez qui transporte votre demande.** Un transporteur pouvait
  prendre une demande que vous aviez publiée à son budget sans que vous l'ayez
  choisi. Maintenant, vous comparez toujours les offres, vous choisissez votre
  transporteur et vous ne payez qu'au moment d'accepter une offre. Chauffeurs :
  « Prendre cette course » n'apparaît plus sur ces demandes — faites une offre
  à la place.
- **Vos informations restent privées.** Une demande ne partage plus l'adresse
  e-mail ni les informations de paiement de quiconque, et l'offre d'un
  transporteur ne montre plus sa plaque d'immatriculation au demandeur. Les
  noms de contact, numéros de téléphone et notes d'accès vont uniquement à la
  personne qui a publié la demande, à notre équipe et, une fois la course
  attribuée, au transporteur qui l'effectue. L'adresse postale et le point
  exact sur la carte vont uniquement aux transporteurs approuvés ; les autres
  voient la ville et un point approximatif, et la recherche par distance sur
  la place de marché se fait à partir de ce même point approximatif. Parcourir
  les demandes nécessite maintenant un compte ; le lien vers une demande
  précise s'ouvre toujours pour tout le monde.
- **Les champs numériques gardent ce que vous voulez dire.** « 040 » devient
  « 40 » à la frappe, dans chaque champ numérique du formulaire de demande et
  dans les champs de prix des transporteurs. Les centimes prennent une virgule
  en français et un point en anglais (« 40,50 »). Supprimer un chiffre ne fait
  plus rétrécir le montant : dans « 200 », remplacer le « 2 » par un « 1 »
  donne « 100 ». Le budget indique tout de suite quand il est inférieur à 1 €
  ou supérieur à 100 000 €, et le nombre d'objets monte maintenant jusqu'à
  99 999.
- **Corrigé : poids et montants enregistrés de travers.** Un poids de 1,05 t
  était enregistré comme 15 t. Dans la fenêtre de devis des opérateurs, un
  prix accepté ou une valeur déclarée de 40,05 € était enregistré comme 405 €,
  et un poids de 12,05 kg comme 125 kg.
- **Transporteurs : la carte Stripe a disparu de votre profil.** Elle vous
  demandait de connecter un compte Stripe pour être payé, ce qui n'est pas la
  façon dont vous êtes payé : après une livraison, demandez votre solde dans
  « Mes gains » et un opérateur le règle par virement bancaire. Le site ne
  promet plus un paiement sous 7 jours, les pages de confidentialité et de
  vérification disent maintenant précisément ce qu'il advient de vos
  coordonnées bancaires, et un trajet livré indique « Crédité sur votre
  solde » plutôt que « Versement programmé ».
- **Transporteurs : une course compte dans votre solde une fois livrée**,
  jamais avant, et une course remboursée est retirée de ce que vous pouvez
  retirer. Une livraison confirmée par vous et par votre chauffeur au même
  moment compte une seule fois.
- **Opérateurs : un retrait contenant une course remboursée ou non livrée ne
  peut plus être approuvé ni enregistré comme payé.** Une demande approuvée
  peut maintenant être refusée, après avoir confirmé que le virement n'a
  jamais été envoyé, ce qui remet dans le solde du transporteur ce qui lui est
  encore dû. Une décision prise depuis une liste périmée — une demande qu'un
  collègue vient d'approuver — est refusée et la liste se rafraîchit, au lieu
  d'être enregistrée sans confirmation.

## [2.59.0] - 2026-10-04 · feat

- **Une page de remerciement une fois votre demande publiée.** Après
  « Publier la demande », vous arrivez sur une page qui vous remercie, donne le
  numéro de référence de votre demande, la relit, indique jusqu'à quand les
  transporteurs peuvent faire des offres, et propose trois suites : voir la
  demande, voir toutes vos demandes, ou en publier une autre. Une demande
  programmée obtient la même page, avec la date de sa mise en ligne. La page
  dit aussi clairement que rien n'est débité avant l'attribution du transport.
- **Indiquez quels jours, et choisissez plusieurs moments de la journée.**
  Quand vos dates sont flexibles, chaque paire de dates — retrait et
  livraison — a maintenant en dessous les jours de la semaine, tous cochés au
  départ : décochez les jours où personne n'est là. Vous pouvez aussi choisir
  le matin *et* l'après-midi (et la soirée), pas seulement un moment ;
  « N'importe quand » signifie les trois. Les transporteurs voient vos jours et
  horaires sur votre demande, et juste à l'endroit où ils choisissent quand
  venir.
- **Enregistrer un brouillon n'échoue plus parce que son retrait est trop
  proche.** « Enregistrer le brouillon » affichait « Le retrait est trop
  proche… » et n'enregistrait rien. Un brouillon s'enregistre maintenant quelle
  que soit la proximité de son retrait — le formulaire doit toujours être
  rempli — et si le retrait empêcherait la publication, la confirmation le
  dit.
- **Le formulaire dit quand le retrait est trop proche pour être publié — à
  l'étape des dates, en termes simples.** Il nomme le premier retrait possible,
  le répète à côté de « Publier », et bloque la publication tant que vous ne
  le changez pas. Quand les transporteurs n'auraient que quelques heures pour
  faire une offre, il vous dit jusqu'à quand.
- **Une demande flexible qui commence aujourd'hui fonctionne maintenant.**
  « Du » aujourd'hui comptait à partir de minuit, ou de ce matin, qui était
  déjà passé, si bien qu'une telle demande ne pouvait jamais être publiée.
  Elle commence maintenant au premier horaire encore possible, et le
  formulaire indique à partir de quand.
- **Fini les boutons qui ne font rien en silence.** Quand quelque chose est à
  corriger, « Publier » et « Enregistrer le brouillon » vous amènent à l'étape
  concernée et disent laquelle — une étape à la fois si vous n'y êtes pas
  encore arrivé, pour qu'aucune étape ne soit jamais sautée sans être vue.
- **Sur téléphone**, les boutons en bas du formulaire, les choix de moment de
  la journée et le lien « Saisissez l'adresse » ne débordent plus de l'écran.

## [2.58.0] - 2026-10-01 · feat

- **Vous n'avez plus besoin d'une carte enregistrée pour accepter une offre.**
  Accepter ouvre maintenant une fenêtre de paiement : payez avec votre carte
  enregistrée en un geste, ou saisissez une carte sur place. Cochez
  « Enregistrer cette carte » si vous voulez qu'elle soit gardée pour la
  prochaine fois ; elle n'est jamais conservée si vous ne cochez pas.
- **Vous voyez ce que vous payez avant de payer.** La fenêtre montre le prix du
  transport, les frais de service et le total prélevé maintenant. Il est
  prélevé au moment où vous choisissez le transporteur, et remboursé si le
  transport est annulé.
- **Les paiements que votre banque veut confirmer passent maintenant.** Si
  votre banque vous demande d'approuver le paiement dans son application ou
  avec un code (3-D Secure), sa fenêtre s'ouvre et vous l'approuvez là.
  Avant, ces paiements échouaient.
- **La même fenêtre s'ouvre quand vous acceptez une offre envoyée dans un
  message.** Avant, un demandeur sans carte enregistrée obtenait « une erreur
  est survenue » dans la conversation.
- **Les codes postaux de 4, 5 ou 6 chiffres sont acceptés sur une demande de
  transport** : 4 en Belgique, en Suisse, en Autriche et au Luxembourg, 5 en
  France, 6 en Roumanie. Avant, « 1000 Bruxelles » était refusé avec « Doit
  comporter 5 chiffres ».
- **Opérateurs : les devis Expedion avec un code postal de 4 ou 6 chiffres ne
  sont plus marqués « code postal manquant ».** Un devis livré à l'étranger
  peut donc être publié sur la place de marché dès qu'il a un point sur la
  carte, comme le pouvaient déjà les devis avec un code étranger à 5 chiffres.
  Aucun des devis actuels n'est concerné : aucun de ceux livrés à l'étranger
  n'a de point sur la carte.
- **Corrigé : une offre que vous aviez refusée dans un message continuait
  d'afficher « En attente » avec les deux boutons.** Elle affiche maintenant
  « Refusée » de votre côté et ne vous demande plus de l'accepter, ni de la
  payer.
- **Le rappel du tableau de bord sur les cartes dit maintenant ce qui est
  vrai** : une carte enregistrée rend l'acceptation plus rapide, et vous
  pouvez accepter sans.
- **Corrigé : accepter une offre sur une demande sans point sur la carte
  affichait un code d'erreur.** Il explique maintenant qu'on ne peut pas
  choisir un transporteur sans point sur la carte pour le retrait et la
  livraison.

## [2.57.1] - 2026-10-01 · fix

- **Corrigé : le résumé de votre demande indiquait « Non précisé » quand vous
  aviez demandé au transporteur de protéger ou d'emballer l'objet.** Sur votre
  page d'accueil et dans « Mes demandes », la ligne Protection affiche
  maintenant « Protection requise » et « Emballage requis » quand vous les avez
  demandés, à côté de « Déjà protégé » ou « Déjà emballé » et de « Fragile ».
- **Corrigé (administration) : « Demandes directes » dans la Vue d'ensemble
  listait les brouillons.** Elle ne liste plus que les demandes réellement
  publiées. Un brouillon, ou une demande programmée pour plus tard, ne peut
  être ouvert que par son auteur ; cliquer sur l'un d'eux affichait donc un
  chargement qui ne finissait jamais.

## [2.57.0] - 2026-09-30 · feat

- **Chaque demande de transport a maintenant un numéro de référence.** Il
  s'affiche « Réf. 100042 » et c'est le même numéro pour tous les
  intervenants : vous le voyez sur la page de la demande, dans « Mes
  demandes », sur vos livraisons, sur l'écran de livraison du chauffeur et en
  haut d'une conversation sur la demande. Donnez-le au transporteur, au client
  ou au support et chacun sait exactement de quel transport vous parlez. Sur
  les pages de demande, de livraison et de chauffeur, un petit bouton le
  copie.
- **Retrouvez une demande par sa référence.** Saisissez le numéro dans la
  recherche de « Voir les demandes », avec ou sans « Réf. », et la demande
  apparaît aussitôt (tant qu'elle est encore ouverte aux offres). Les
  administrateurs peuvent aussi la chercher dans le tableau des demandes.
- **La référence figure dans l'e-mail et la notification que vous recevez quand
  votre demande est mise en ligne**, pour que vous l'ayez avant qu'on vous la
  demande.
- **Les trajets terminés et votre relevé d'activité affichent la référence de
  la demande.** Ils affichaient un code interne qui ne voulait rien dire pour
  personne d'autre.
- **Quand le client confirme un retrait ou une livraison depuis le lien de son
  SMS, la page affiche la référence de la demande.** Elle affichait le titre
  de la demande sous « Référence ».
- **« Voir les demandes » ne mentionne plus Expedion Enchères.** La bannière en
  haut de la place de marché et l'étiquette « via Expedion » sur les demandes
  ont disparu, et la description d'un retrait en maison de vente ne se termine
  plus par « Job escaladé depuis Expedion Enchères ». Une demande est une
  demande, d'où qu'elle vienne. La chronologie de livraison indique maintenant
  que le client a confirmé « via son application mobile ».

## [2.56.0] - 2026-09-30 · feat

- **Dites au transporteur quoi faire de votre objet avant qu'il parte.**
  Quand vous demandez un transport, il y a deux nouveaux interrupteurs :
  « Protection requise » (le transporteur l'enveloppe — film à bulles,
  couvertures) et « Emballage requis » (le transporteur apporte un carton et
  l'emballe). Vous pouvez demander l'un, l'autre ou les deux. Les
  transporteurs les voient sur la place de marché, sur la page de la course et
  sur leur écran de livraison, pour pouvoir chiffrer le travail et apporter ce
  qu'il faut.
- **« Protégé » et « Emballé » deviennent « Déjà protégé » et « Déjà
  emballé ».** Ils ont toujours décrit la façon dont vous avez préparé
  l'objet vous-même ; les nouveaux noms le disent, et ils se placent juste
  au-dessus des deux nouveaux services. Choisissez-en un qui en contredit un
  autre et ce dernier se désactive — un objet déjà emballé n'a pas besoin
  d'emballage.
- **Les lots de vente aux enchères d'Expedion disent ce dont ils ont besoin.**
  Un lot que le client déclare non protégé affiche maintenant « Protection
  requise » au lieu de « Aide au chargement », et un lot protégé affiche
  « Déjà protégé ».
- **Corrigé : une seconde barre de défilement à droite de « Demander un
  transport ».** La faire glisser emmenait la page sur une zone blanche vide
  sous le formulaire, ce qui donnait l'impression que la page était cassée. Il
  n'y a de nouveau qu'une seule barre de défilement, et elle fait défiler le
  formulaire. L'espace chauffeur et l'espace administration reçoivent la même
  correction.

## [2.55.0] - 2026-09-30 · ux

- **Votre demande se lit maintenant en entier sur votre page d'accueil.**
  « Votre demande » affiche le trajet à côté du nom de l'objet, les fenêtres
  de retrait et de livraison, la façon dont l'objet est protégé, ce qui est
  déplacé et le budget, là où elle n'affichait que le nom de l'objet. « Mes
  demandes » affiche le même résumé sur chaque demande.
- **La carte « Commencez à conduire avec EXPEDITOO » ne s'adresse plus aux
  personnes qui publient des demandes.** Une fois que vous avez publié une
  demande, votre page d'accueil parle de cette demande. Vous pouvez toujours
  candidater pour conduire : ouvrez n'importe quelle course et l'invitation
  est là, au moment où vous voudriez faire une offre.
- **Les demandes publiées sur Expeditoo apparaissent maintenant dans la Vue
  d'ensemble de l'administration (« Supervision »).** Une nouvelle carte
  « Demandes directes » sous « Devis récents » liste les cinq demandes les plus
  récentes faites avec « Demander un transport », et combien il y en a au
  total. « Devis récents » ne listait que des devis Expedion, issus de
  l'import Airtable et de l'application Expedion, si bien qu'une demande
  publiée sur le site n'y apparaissait jamais. Cliquez sur l'une d'elles pour
  l'ouvrir.
- **Les annonces de l'administration montrent d'où vient chaque course et où
  elle va.** Chaque ligne indique « Directe » ou « via Expedion » et montre le
  trajet, la recherche trouve aussi les villes, et la colonne « Vendeur »
  devient « Demandeur ».
- **Corrigé : une nouvelle demande pouvait sembler absente des annonces de
  l'administration.** La liste continuait d'afficher ce qu'elle avait chargé
  jusqu'à cinq minutes plus tôt. Elle se rafraîchit maintenant à chaque
  ouverture.
- **Votre nom est maintenant en haut à droite de chaque écran** : l'application,
  l'espace chauffeur et le panneau d'administration. Cliquez dessus pour ouvrir
  votre profil. Sur téléphone, ce sont vos initiales qui s'affichent.

## [2.54.0] - 2026-09-24 · feat

- **Vous ne trouvez pas votre lieu sur la carte ? Vous pouvez maintenant coller
  un lien Google Maps au lieu de saisir l'adresse.** Après « Vous ne trouvez
  pas ? », choisissez entre « Saisir l'adresse » et « Lien Google Maps ».
  Collez le lien depuis Google Maps (appuyez longuement sur l'endroit,
  Partager, Copier le lien) et le point exact est utilisé, avec l'adresse
  remplie pour vous — corrigez-la si elle n'est pas tout à fait juste, et
  utilisez « Vérifier sur Google Maps » pour vous assurer que le point est le
  bon.
- **Un lieu donné par un lien s'accompagne d'une description de l'endroit.**
  Un lien montre au transporteur où aller, pas ce qu'il doit repérer une fois
  arrivé ; l'application vous demande donc de décrire l'endroit — « portail
  bleu à gauche, 200 m après l'église ». Le transporteur la lit sur son écran
  de livraison, sous la carte du point exact.
- **Corrigé : remplir l'adresse depuis la carte pouvait laisser d'anciennes
  erreurs à l'écran.** Après un « Suivant » échoué, choisir un lieu sur la
  carte remplissait la ville et le code postal mais continuait d'afficher « La
  ville est obligatoire » et « Doit comporter 5 chiffres » jusqu'à ce que vous
  appuyiez de nouveau sur « Suivant ».

## [2.53.0] - 2026-09-23 · feat

- **Les administrateurs et opérateurs peuvent maintenant ajouter un chauffeur
  qui travaille directement pour Expeditoo.** « Ajouter un chauffeur interne »,
  sur la page des chauffeurs, prend les informations du chauffeur et un
  véhicule, et le chauffeur est approuvé dès l'enregistrement — il n'y a pas
  de candidature à examiner. Une personne nouvelle reçoit un e-mail avec un
  lien pour définir son propre mot de passe ; si l'adresse e-mail a déjà un
  compte, ce compte est converti et garde sa connexion.
- **Un chauffeur ajouté ainsi peut être réservé tout de suite.** Son véhicule
  est enregistré dès le départ, il apparaît donc dans « attribuer depuis le
  vivier » sur une course Expedion payée, sans rien d'autre à renseigner
  d'abord.

## [2.52.3] - 2026-09-23 · infra

- **Rien de visible ne change pour l'instant.** Cette version ajoute l'outil
  qui remplit la plateforme avec un premier jeu de transports réalistes pour la
  bêta : un trajet livré avec son reçu et le versement du chauffeur, un trajet
  qui attend que son chauffeur parte, une course avec une offre en attente
  d'être choisie, un brouillon, une conversation avec un chauffeur, et une
  course Expedion escaladée qu'un opérateur doit attribuer. Une fois l'outil
  lancé, le compte propriétaire a quelque chose de réel sur chaque écran, de
  chaque côté — chauffeur, demandeur et opérateur.

## [2.52.2] - 2026-09-23 · fix

- **« Retour » dans les panneaux d'administration et chauffeur vous en fait
  enfin sortir.** Il vous ramenait aussitôt dans le panneau que vous
  cherchiez à quitter.
- **Passer en mode « Chauffeur » ou « Utilisateur » depuis le panneau
  d'administration fonctionne désormais.** Il revenait de lui-même sur
  « Admin » dès que vous choisissiez autre chose.
- **Une longue page d'administration ne fait plus défiler tout l'écran sous la
  barre latérale.** Faire défiler une page très remplie emportait la barre
  latérale avec elle et laissait un espace vide ; désormais seul le contenu de
  la page défile et la barre latérale reste en place.

## [2.52.1] - 2026-09-23 · fix

- **La barre latérale d'administration n'avale plus ses propres liens du
  bas.** Sur un écran d'ordinateur portable, « Retraits », « Incidents »,
  « Retours », « Chats de support » et « Paramètres » pouvaient être coupés en
  bas du panneau, sans aucun moyen de faire défiler jusqu'à eux : la liste
  s'arrêtait net, tronquée en plein milieu.

## [2.52.0] - 2026-09-23 · feat

- **Les réglages de notification indiquent désormais comment vous serez
  prévenu, et pas seulement si vous le serez.** Chaque catégorie de la page
  Paramètres a sa propre case, avec une coche pour chaque moyen dont EXPEDITOO
  dispose pour vous joindre : les notifications de retrait, de trajet en cours
  et de livraison peuvent maintenant être désactivées séparément par e-mail et
  par notification push.
- **Une nouvelle section « Alertes de trajet » permet de désactiver en une
  fois, pour tout votre compte, les notifications push de correspondance de
  trajet.** Déclarer un trajet dans « Mes trajets » et demander à être alerté
  des demandes correspondantes fonctionne exactement comme avant ; ce nouvel
  interrupteur couvre tout le compte, vous n'avez donc plus à le désactiver
  trajet par trajet.

## [2.51.0] - 2026-09-23 · ux

- **Le bouton de retour d'expérience dit maintenant à quoi il sert avant que
  vous cliquiez.** Le bouton à icône seule de l'en-tête et « J'ai une demande »
  sur l'écran du profil utilisaient tous deux une icône en forme de papier
  avion, sans autre explication que leur libellé. Les deux affichent
  maintenant une icône de bug, et le survol de l'un ou l'autre révèle
  « Signalez un bug ou proposez une idée — nous lisons tout. »

## [2.50.2] - 2026-09-23 · feat

- **Le sélecteur de véhicule de l'écran flotte d'un chauffeur propose
  maintenant les catégories dans lesquelles les gens pensent vraiment** :
  petite voiture, berline, break, camionnette, camion 20 m³, camion et camion
  hayon, à la place des anciennes classes de poids techniques (3,5 t / 7,5 t /
  19 t). Une case « hayon élévateur » existait déjà séparément pour n'importe
  quel véhicule ; « camion hayon » est une nouvelle option à côté, pour le cas
  où c'est la catégorie entière du véhicule plutôt qu'un équipement
  supplémentaire.

## [2.50.1] - 2026-09-23 · ux

- **Transporteur et Chauffeur forment maintenant un seul rôle, « Chauffeur »,
  dans Admin → Utilisateurs.** Ce n'ont jamais été deux personnes différentes
  sur cette plateforme : approuver la candidature d'un chauffeur accorde déjà
  les deux ensemble, et tous les autres écrans qui affichent un rôle les
  présentent déjà comme une seule et même chose. Permettre à un administrateur
  d'accorder ou de retirer l'un sans l'autre, comme le faisait la boîte de
  dialogue des rôles, ne pouvait que créer un compte incohérent. Ajouter ou
  retirer « Chauffeur » déplace désormais toujours les deux à la fois.
- **« Expéditeur » n'apparaît plus dans la liste des rôles.** Chaque compte le
  reçoit automatiquement dès son inscription, et il ne débloque rien à lui
  seul : on ne le propose donc plus comme quelque chose à ajouter ou à
  retirer, seuls les rôles qui changent réellement ce qu'un compte peut faire
  y figurent.
- **« Gérer le rôle de l'utilisateur » affiche maintenant les rôles déjà
  détenus par un compte sous forme de pastilles que l'on peut retirer, avec
  une liste déroulante dessous pour en ajouter un autre**, au lieu d'une seule
  liste déroulante et d'une ligne « rôle actuel » qui n'en montrait jamais
  qu'un, même pour les comptes qui en cumulent plusieurs.

## [2.50.0] - 2026-09-23 · feat

- **Publier une demande de transport ne vous oblige plus à placer un repère
  sur la carte.** Saisissez plutôt l'adresse de retrait ou de livraison à la
  main : la carte sert à vous aider à trouver l'endroit exact, pas à vous
  bloquer si vous préférez la passer. Une fois que la carte vous a trouvé une
  adresse, ces champs se verrouillent (c'est la réponse de la carte, pas une
  seconde chose à saisir) ; « Vous ne trouvez pas ? » bascule vers la saisie
  manuelle et masque la carte pendant que vous tapez.
- **Le champ de poids exact accepte maintenant des kilogrammes ou des
  tonnes**, grâce à une liste déroulante à côté : une charge lourde n'a plus à
  être saisie en un nombre de kilogrammes à cinq chiffres.
- **Les cartes de poids et de taille sont plus grandes et plus faciles à
  lire**, avec un troisième exemple d'objet ajouté à l'aide de chacune.
- **Un libellé qui chevauchait son propre champ a été corrigé** sur la saisie
  du poids exact.
- **Cliquer n'importe où sur une ligne de candidature de chauffeur l'ouvre
  maintenant**, et non plus seulement la petite icône en forme d'œil à
  droite.

## [2.49.0] - 2026-09-23 · feat

- **Les réglages de notification par e-mail sont maintenant précis, et non plus
  un interrupteur fourre-tout.** « Messages d'annonces » est remplacé par trois
  interrupteurs distincts : *Annonce publiée* (une confirmation dès que votre
  demande est en ligne), *Transporteur & paiement* (votre reçu, dès qu'un
  chauffeur est confirmé et payé) et *Suivi du trajet* (un e-mail au retrait,
  un en cours de route, un à la livraison). Chacun peut être désactivé
  séparément. L'ancien interrupteur unique ne faisait silencieusement rien
  quand on le basculait ; ces trois-là fonctionnent vraiment.
- **Le panneau d'administration a maintenant un sélecteur de langue.** FR/EN,
  à côté de la cloche de notifications, comme sur tous les autres écrans de
  l'application.
- **`/admin/listings` affiche maintenant toutes les demandes, pas seulement
  les ouvertes.** Le point d'accès réutilisait la requête du tableau des
  chauffeurs, qui ne renvoie que les demandes `open` encore dans leur fenêtre
  d'offres : une demande attribuée, terminée, annulée ou expirée était
  invisible pour l'équipe, en silence, sans aucune erreur. Le tableau
  lui-même était en outre resté câblé sur l'ancienne forme des enchères de
  biens (un `seller`, un simple prix, des statuts `sold`/`ended`/`active` qui
  n'existent pas sur une demande de transport), si bien qu'une vraie ligne
  s'affichait comme un vendeur sans nom à 0,00 € au lieu de l'expéditeur et de
  son budget. Les deux sont corrigés : une requête de modération dédiée, sans
  filtre de statut, et un tableau qui lit les vrais champs de la demande.

## [2.48.0] - 2026-09-23 · feat

- **Un trajet que vous déclarez dans `/carrier/trips` peut désormais vraiment
  vous alerter.** Activez « M'alerter des courses correspondantes » et vous
  recevrez une notification dès qu'une demande correspondante apparaît : dans
  votre rayon, dans votre sens de circulation, un jour où vous roulez.
  L'interrupteur existait depuis un moment ; jusqu'ici il se contentait
  d'enregistrer votre préférence sans en faire quoi que ce soit.

## [2.47.0] - 2026-09-23 · feat

Quatorze points de la file de retours, tous remontés par le bouton intégré à l'application.

- **Une nouvelle taille XS**, pour une montre ou un téléphone, et « S »
  montre désormais à la place une paire de chaussures en exemple, à la bonne
  échelle de ce que les gens essayaient réellement d'y faire entrer.
- **Vous pouvez maintenant nous donner le poids exact**, et pas seulement une
  tranche, sur toute catégorie de poids sauf « Je ne sais pas » : utile quand
  vous le connaissez et voulez une correspondance plus précise que « 5 –
  30 kg ».
- **Deux nouveaux boutons pour indiquer comment l'objet est protégé** :
  « Protégé » (film bulle, couverture, polystyrène…) ou « Emballé » (protégé,
  puis mis en carton), à côté de Fragile et Aide au chargement, pour que le
  transporteur sache ce qu'il va charger avant d'arriver.
- **Les cartes de poids et de taille se voient mieux** avant d'en choisir
  une : le cadre autour de chacune se distinguait à peine du fond de la page.
- **Les adresses enregistrées peuvent maintenant dire à quoi elles servent**
  (Domicile, Travail, Stockage, Voisin ou un nom personnalisé), à choisir dans
  une liste au lieu de les retaper à chaque fois.
- **Ajouter une adresse ne demande plus la carte.** Saisissez la rue, la ville
  et le code postal, c'est terminé ; la carte sert à placer l'endroit exact,
  pas à vous bloquer si vous préférez la passer. Elle n'écrase plus non plus
  une adresse que vous avez déjà saisie quand vous déplacez le repère.
- **Le trajet déclaré par un chauffeur peut maintenant préciser le pays** de
  chaque extrémité, et un nouveau véhicule peut être indiqué comme équipé d'un
  hayon.
- **Plusieurs écrans disent maintenant ce qu'ils veulent dire.** « Résultats
  d'enchères » dans vos réglages de notification devient « Messages
  d'annonces » ; la « Zone dangereuse » des Paramètres devient « Suppression
  de compte » ; le texte d'introduction du formulaire de demande ne parle plus
  de transporteurs qui « enchérissent » ; l'étape de la taille a perdu son
  indication « facultatif, passez si vous ne savez pas » ; le tableau des
  demandes ouvertes ne dit plus « Missions » ; et le mot « TRANSPORT » sous le
  logo EXPEDITOO a disparu de l'application (il reste sur le site
  vitrine).
- **« Ajouter un autre objet » dans le formulaire de demande** est confirmé
  comme fonctionnel : il avait été livré discrètement dans une version
  précédente sans jamais être annoncé.

## [2.46.0] - 2026-09-23 · feat

- **Publier une demande ne nécessite plus de carte au préalable.** Votre
  demande peut être mise en ligne tout de suite : ajoutez une carte depuis
  votre profil quand vous le souhaitez, et on ne vous la redemandera que si
  vous essayez d'accepter une offre alors qu'aucune n'est enregistrée. Si une
  de vos demandes est ouverte aux offres sans carte, vous verrez un rappel sur
  votre écran d'accueil.
- **Choisissez quand votre demande est mise en ligne.** « Quand » propose
  maintenant deux options : la publier tout de suite, ou choisir une date et
  une heure précises pour la publier plus tard. Une demande programmée reste
  cachée aux transporteurs jusqu'à ce moment.
- **Les administrateurs peuvent maintenant fixer des frais de plateforme**,
  ajoutés au montant payé par le client une fois un transporteur choisi,
  depuis une nouvelle page Paramètres : distincts de la commission du
  chauffeur et affichés sur leur propre ligne du reçu.

## [2.45.0] - 2026-09-22 · feat

- **Publier une demande de transport la confirme maintenant de trois façons.**
  Envoyez « Demander un transport » et vous recevez un e-mail de confirmation
  dans votre boîte de réception, une alerte dans votre cloche de notifications
  et l'état de votre demande (ouverte, attribuée ou en route) directement sur
  votre écran d'accueil : vous savez toujours qu'elle est bien passée et où
  elle en est.

## [2.44.0] - 2026-09-22 · feat

- **Candidater pour conduire prend maintenant quelques minutes, et non plus un
  dossier complet.** Vous pouvez envoyer votre candidature avec seulement les
  coordonnées de votre entreprise et vos coordonnées de contact : pièce
  d'identité, permis, assurance, coordonnées bancaires et véhicule peuvent
  tous être ajoutés plus tard, à votre rythme. Si votre dossier semble bon sur
  cette seule base, un administrateur peut vous approuver et vous complétez le
  reste ensuite.
- **Les informations de versement peuvent être ajoutées à tout moment après
  votre approbation**, et pas seulement avant l'envoi, de sorte qu'il n'est
  plus nécessaire de mettre vos premiers documents en ordre avant d'être
  autorisé à commencer.

## [2.43.1] - 2026-09-22 · fix

- **Le champ SIRET est moins tatillon.** Il vérifiait les 14 chiffres avec une
  somme de contrôle interne en plus de leur nombre, ce qui pouvait faire
  rejeter un vrai SIRET pour un seul chiffre mal saisi. Il vérifie désormais
  seulement qu'il y a 14 chiffres : la confirmation de l'entreprise
  elle-même a déjà lieu lors de l'examen de la candidature.

## [2.43.0] - 2026-09-22 · feat

- **Une note pour le transporteur et un vrai numéro de téléphone, au retrait
  comme à la livraison.** « Que déplacez-vous ? » vous permet maintenant de
  dire où exactement et qui appeler : une note facultative pour les consignes
  d'accès (« deuxième étage, après la porte rouge ») et un numéro de contact
  obligatoire, car la personne qui publie la demande n'est pas toujours celle
  qui ouvre la porte. Le transporteur voit les deux une fois la demande qui
  lui est attribuée, y compris pendant la livraison elle-même.
- **Vous ne trouvez pas votre adresse sur la carte ? Collez plutôt un
  lien.** Le sélecteur de retrait et de livraison accepte maintenant un lien
  Google Maps, Apple Maps, Bing Maps, Waze ou OpenStreetMap, y compris un lien
  de partage court depuis votre téléphone, et place le repère pour vous.
- **Le champ « Que déplacez-vous ? » accepte maintenant une réponse de
  2 caractères** au lieu d'en exiger 5, et propose beaucoup plus d'objets
  courants à choisir (matelas, armoires, table de salle à manger, télévision,
  piano, etc.) en plus de ceux d'origine.

## [2.42.1] - 2026-09-22 · fix

- **Un SIRET collé tel qu'il est imprimé sur un document officiel fonctionne
  maintenant.** Les documents du registre français regroupent un SIRET en
  blocs (`732 829 320 00074`) : le saisir ou le coller exactement ainsi, ou
  avec une espace de fin parasite due à la correction automatique d'un
  clavier, était rejeté comme invalide alors que tous les chiffres étaient
  justes. Il est désormais accepté avec ou sans espaces, et le champ regroupe
  lui-même les chiffres selon ce même schéma pendant que vous tapez.
- **Le champ de téléphone du transporteur est maintenant présenté comme un
  numéro français**, avec 🇫🇷 +33 affiché à côté et un exemple prérempli, au
  lieu d'une simple case sans aucune indication du format attendu.

## [2.42.0] - 2026-09-18 · ux

- **Les fiches de retour prennent la couleur de leur statut** : les mêmes
  couleurs ouvert, en cours, à vérifier, résolu et archivé que celles déjà
  utilisées sur les tuiles et icônes de statut, pour qu'un administrateur qui
  parcourt la file de tri n'ait plus à lire la liste déroulante de chaque
  fiche pour savoir où elle en est.
- **La file des retours peut être triée**, et pas seulement filtrée : ordre de
  tri (par défaut), plus récents d'abord, plus anciens d'abord, par nom de
  l'auteur ou par priorité.
- **Une capture d'écran de retour s'ouvre maintenant sur place.** Cliquer sur
  une miniature dans la file de tri vous faisait quitter la console pour un
  nouvel onglet ; elle s'ouvre désormais dans une boîte de dialogue à côté du
  ticket, pour qu'un administrateur ne perde jamais sa place dans la file
  en regardant une capture.

## [2.41.1] - 2026-09-13 · fix

- **L'historique des devis Expedion est de retour.** Tous les devis demandés
  via Expedion, soit 4 656 au total dont 65 qui n'avaient jamais été
  transférés, sont de nouveau visibles par l'équipe, après que le passage à
  une nouvelle base de données a laissé le panneau d'administration vide. Rien
  de ce qui existait déjà n'a été remplacé.

## [2.41.0] - 2026-09-13 · ux

- **La quantité se place maintenant à côté de ce que vous expédiez.** Dans le
  formulaire de demande de transport, « combien » est demandé sur la même
  ligne que « Que déplacez-vous ? », au lieu d'avoir sa propre ligne plus bas
  dans la page, après le poids et la taille. Ce changement nous est venu par
  le bouton de retour.

## [2.40.5] - 2026-09-13 · fix

- **Les images que vous importez s'affichent maintenant.** Les captures
  d'écran jointes aux retours, les photos d'une demande de transport, les
  photos d'incident et les photos de profil étaient toutes importées sans
  erreur, mais chacune s'affichait comme une image cassée. L'adresse donnée à
  chaque import pointait vers un serveur qui n'existe pas. Les images se
  chargent maintenant depuis la plateforme elle-même.
- **L'unique capture d'écran envoyée avant ce correctif** garde son ancienne
  adresse morte tant qu'une correction d'une ligne ne lui a pas été appliquée ;
  tout ce qui est importé à partir de maintenant fonctionne tout de suite.

## [2.40.4] - 2026-09-13 · infra

- **Rien de visible ne change.** Lorsque la tâche qui met à jour la base de
  données en production échoue, la page de résumé de l'exécution affiche
  maintenant l'explication donnée par la base elle-même, et non plus
  seulement « Process completed with exit code 1 ».

## [2.40.3] - 2026-09-13 · fix

- **Vos documents de paiement sont maintenant de véritables factures.**
  Chacun émis à partir d'aujourd'hui porte l'identité légale complète de la
  société (ATOUT GLOBAL SERVICES, SAS, SIRET, RCS et numéro de TVA) et
  s'intitule *Facture* et non plus *Reçu de paiement*. La TVA est indiquée
  comme non applicable (article 293 B du CGI) pour l'instant, dans l'attente
  de la confirmation du régime de TVA de la société. Les documents déjà émis
  restent tels quels : un reçu ne peut pas devenir une facture après coup.
- **La tâche qui met à jour la base de données en production peut de nouveau
  s'y connecter.** L'adresse de connexion fournie par notre hébergeur de base
  de données contient un paramètre que ses propres outils comprennent mais que
  notre pilote transmettait tel quel à la base, qui le refusait. Une fois cette
  tâche exécutée, confirmer un retrait ou une livraison depuis l'application
  fonctionne.
- Rien d'autre de visible ne change : le code et les paquets que plus rien
  n'utilisait ont été supprimés.

## [2.40.2] - 2026-09-13 · infra

- **Rien de visible ne change.** La tâche qui applique les changements de base
  de données au site en production refusait les informations de connexion
  qu'on lui donnait, en disant seulement qu'elle voulait un autre type
  d'adresse, ce qui était faux et ne donnait à personne de quoi agir.
- Ces informations de connexion sont saisies à la main dans un formulaire web,
  si bien qu'elles arrivent entourées de guillemets ou précédées du `psql` que
  le bouton de copie d'un tableau de bord de base de données ajoute devant.
  C'est la même adresse sous un habillage différent, et la tâche voit
  maintenant à travers les trois cas. Quand elle ne peut vraiment pas lire une
  valeur, elle dit maintenant ce qu'elle a reçu, pour que la personne suivante
  n'ait pas à deviner.

## [2.40.1] - 2026-09-13 · infra

- **Rien de visible ne change.** La tâche qui applique les changements de base
  de données au site en production ne pouvait pas démarrer : elle demandait
  quelle version de son outil de build utiliser et le projet ne l'avait jamais
  indiquée, si bien qu'elle s'arrêtait avant d'atteindre la base. C'est
  corrigé, et la réponse vit désormais à un seul endroit que lisent à la fois
  les vérifications en production et la tâche de base de données, de sorte que
  les deux ne peuvent plus diverger.
- Cela comptait car la version précédente avait livré un changement dont la
  base de données n'avait pas encore été informée. Confirmer un retrait ou une
  livraison depuis l'application aurait échoué tant que la tâche n'avait pas
  été exécutée.

## [2.40.0] - 2026-09-10 · feat

- **Vous pouvez confirmer un retrait ou une livraison depuis l'application
  elle-même.** Jusqu'ici, la seule façon de dire « oui, c'est bien arrivé »
  était le lien du SMS ou de l'e-mail : si vous l'aviez supprimé, vous étiez
  bloqué, même en regardant la livraison à l'écran. Il y a maintenant un
  bouton sur la page de livraison. Il n'affiche que les étapes que le
  transport a réellement atteintes, et une fois l'une d'elles confirmée, il
  l'indique, avec la date, au lieu de proposer à nouveau le bouton.
- **Confirmer ne change toujours rien par soi-même.** Cela enregistre que vous
  êtes d'accord pour dire que c'est arrivé. C'est le transporteur qui fait
  avancer le transport, et rien de ce que vous appuyez ne peut le faire
  avancer, prélever un paiement ou clore une demande : c'est précisément pour
  cela que le lien que nous vous envoyons par SMS peut sans risque être envoyé
  à quelqu'un qui n'a pas de compte.
- **Le transporteur ne peut pas confirmer à votre place.** Il fait avancer le
  statut ; vous l'attestez. Un opérateur qui confirme pour un client qui ne
  peut pas le faire est enregistré en tant qu'opérateur, jamais en tant que
  client.
- **Vous voyez de quel type d'activité relève un transporteur, quand il l'a
  indiqué.** Sa forme juridique (auto-entrepreneur, SASU, etc.) s'affiche
  maintenant sur sa fiche lorsqu'il en a déclaré une, dans l'onglet
  *Transporteurs disponibles*. Là où personne n'a rien déclaré, rien ne
  s'affiche : une réponse vide signifie « non précisé », pas « particulier », et
  deviner le statut juridique de quelqu'un reviendrait à l'inventer.
- **Vos reçus disent où ils sont envoyés.** La page des factures vous indique
  maintenant que chaque reçu vous est envoyé par e-mail dès que le paiement est
  prélevé, et que WhatsApp n'est pas encore disponible : personne n'attend donc
  un message qui ne viendra pas. Vous pouvez toujours vous renvoyer le
  document, comme avant, en un seul appui.

## [2.39.0] - 2026-09-10 · ux

- **Le bouton de configuration des versements fonctionne, et vous dit quand il
  ne peut pas.** Appuyer sur *Continuer la configuration* sur votre profil ne
  faisait strictement rien : ni message, ni indicateur de chargement, ni
  erreur. Il montre maintenant qu'il travaille, et lorsque Stripe refuse la
  demande, il le dit au lieu de vous laisser appuyer sur un bouton qui semble
  cassé. Stripe a actuellement suspendu la création de nouveaux comptes de
  versement de notre côté, ce que verront donc la plupart des gens tant que
  nous n'aurons pas réglé cela avec eux ; avant aujourd'hui, vous n'aviez
  aucun moyen de le savoir.
- **Revenir de Stripe avec un lien expiré s'explique aussi maintenant.** Ce
  trajet se terminait lui aussi en silence, sur la même page de profil, sans
  qu'un mot soit dit.
- **Toute personne connectée peut publier une demande de transport depuis
  n'importe où dans l'application.** Les deux boutons du haut n'apparaissaient
  que pour les chauffeurs approuvés, si bien qu'un tout nouveau compte voyait
  une barre vide qui semblait cassée. Pire sur téléphone : la barre du bas
  proposait le tableau des demandes, sur lequel un nouveau compte ne peut pas
  faire d'offre, et aucun moyen de publier une demande. Publier est maintenant
  proposé à toute personne ayant un compte ; le tableau des demandes reste
  réservé aux chauffeurs approuvés, seuls à pouvoir faire une offre.
- **La localisation imprimée sur les photos de retrait et de livraison est
  maintenant lisible.** Le bandeau au bas de chaque photo arrivait comme une
  barre noire sans aucune lettre une fois l'application passée sur son serveur
  de production. La date, le lieu et la référence s'impriment maintenant
  correctement, dans la même police que celle utilisée partout ailleurs dans
  l'application.
- **La configuration des versements vise maintenant le bon compte.** Lorsque
  les versements automatiques seront activés, ils atteindront le compte Stripe
  qu'un chauffeur a réellement connecté. Jusqu'à aujourd'hui, ils auraient
  échoué pour tous les chauffeurs, car l'application cherchait ce compte à un
  endroit où personne n'avait jamais rien écrit.

## [2.38.0] - 2026-09-10 · feat

- **Vous pouvez désormais nous écrire depuis n'importe où dans l'application.**
  Un nouveau bouton dans la barre du haut ouvre un court formulaire : bug, idée
  ou commentaire, écran concerné, ce qui s'est passé, et jusqu'à quatre
  captures d'écran. Il est présent sur chaque écran, sur téléphone comme sur
  ordinateur, et pour tout le monde, pas seulement pour les chauffeurs
  approuvés.
- **Vous voyez ce qu'est devenu ce que vous avez envoyé.** Un deuxième onglet
  liste tout ce que vous nous avez écrit avec son statut actuel : un signalement
  déposé ne disparaît plus dans le vide.
- **L'équipe dispose d'un endroit où traiter les retours.** Le personnel a un
  nouvel écran « Retours » : cinq compteurs en haut, recherche et filtres, et la
  possibilité de définir une priorité, de faire avancer un retour et d'y joindre
  des notes privées. Toutes les personnes qui trient sont prévenues dès qu'un
  nouveau retour arrive.

## [2.37.2] - 2026-09-10 · fix

- **Le nettoyage hebdomadaire des images ne peut plus vider le stockage des
  photos.** Il décidait quoi supprimer en demandant à la base de données quelles
  images sont encore utilisées, et considérait tout le reste comme des
  déchets : avec la plateforme sur une base neuve, il aurait supprimé toutes les
  photos trouvées, à trois heures du matin un dimanche, sans retour possible. Il
  refuse désormais de s'exécuter quand la base ne pointe vers rien, ou quand un
  seul passage supprimerait plus d'un cinquième de ce qui est stocké.

## [2.37.1] - 2026-09-10 · fix

- **La connexion refonctionne.** Pendant plusieurs jours, personne n'a pu entrer,
  ni avec Google, ni avec un e-mail et un mot de passe, et chaque page qui
  demande un compte échouait. La base de données utilisée par la plateforme
  avait été supprimée par le service qui l'hébergeait. La plateforme a été
  déplacée vers une nouvelle base et fonctionne de nouveau.
- **Les comptes doivent être recréés.** Les anciens n'ont pas pu être
  récupérés. Inscrivez-vous avec la même adresse et vous retrouvez votre place.

## [2.37.0] - 2026-09-10 · ux

- **Chaque écran indique désormais la version que vous utilisez.** Le numéro de
  version se trouve à gauche de la barre du haut, dans l'application, dans le
  panneau chauffeur et dans le panneau d'administration, ainsi qu'à côté de la
  mention de copyright en bas du site.
- **Un appui dessus ouvre les notes de version.** « Quoi de neuf depuis la
  semaine dernière ? » est désormais à un appui de là où vous vous trouvez, au
  lieu d'être une page dont il fallait connaître l'existence.

## [2.36.0] - 2026-09-05 · feat

- **Un transporteur qui se désiste ne détruit plus la livraison du client.**
  Annuler une demande et la rendre étaient le même bouton, alors que ce sont
  deux choses opposées : le client n'a plus besoin du transport, ou le chauffeur
  ne peut pas l'effectuer. Un chauffeur qui abandonnait une demande anéantissait
  la livraison d'un client qui avait payé, sans bruit et sans retour possible.
  Rendre une demande la remet désormais sur le tableau des demandes, rétablit
  les offres qui avaient perdu face à lui, et le client conserve son transport.
- **Le client est informé de ce qui s'est réellement passé**, au lieu d'apprendre
  que son transport est annulé alors qu'il est en réalité relancé.
- **Les chauffeurs dont l'offre n'avait pas été retenue sont prévenus quand une
  demande revient**, pour que ce retour sur le tableau des demandes atteigne
  ceux qui la voulaient déjà.
- **Chacun dit pourquoi, à partir d'une courte liste.** Une panne de camionnette,
  un chauffeur malade, une marchandise qui ne correspondait pas à la description
  de la demande, un site d'enlèvement inaccessible ou, côté client, plus
  besoin du transport, dates modifiées, organisé ailleurs. La marchandise et
  l'accès figurent volontairement dans la liste : c'est le chauffeur qui appuie
  sur le bouton, mais la cause est la description ou le site, et un futur score
  de fiabilité ne doit pas les lui imputer.
- **Rendre une demande avant l'enlèvement ne demande l'accord de personne.** Un
  chauffeur dont la camionnette est en panne à six heures du matin et qui doit
  attendre que quelqu'un clique sur approuver, c'est une demande qui meurt
  pendant les seules heures où elle pouvait encore être revendue.
- **Une fois la marchandise enlevée, une seule personne ne peut plus mettre fin
  seule au trajet.** Après l'enlèvement, la marchandise est dans un véhicule, et
  mettre fin au transport de quelqu'un d'autre devient une décision de
  l'opérateur.
- **Un opérateur peut désormais arrêter un trajet déjà en route.** Le produit
  l'affirmait depuis le premier jour sans jamais pouvoir le faire.
- **Une annulation libère toujours l'argent du client**, et pour un client
  Expedion qui annule depuis sa propre application, le remboursement qui lui est
  dû est enregistré là-bas au lieu d'être supposé.

## [2.35.0] - 2026-09-05 · feat

- **Vous voyez désormais quels transporteurs font déjà votre trajet, au lieu
  d'attendre en silence.** La page d'une demande a un nouvel onglet
  *Transporteurs disponibles* qui liste les chauffeurs approuvés dont le trajet
  déclaré couvre votre enlèvement et votre livraison, dans cet ordre, pendant
  les jours où vous avez demandé l'enlèvement.
- **Un appui lance la conversation, avec le message d'ouverture déjà rédigé.**
  *Contacter* ouvre une conversation sur cette demande et, comme elle est
  rattachée à la demande, le chauffeur peut vous y envoyer un prix.
- **C'est un moyen d'être trouvé, pas une seconde façon d'attribuer.** Rien ici
  ne dépose une offre, ne déplace d'argent ni ne change le statut d'une demande :
  c'est toujours un opérateur qui choisit le gagnant parmi les offres.
- **Les opérateurs le font à la place du client sur les demandes Expedion**, car
  personne ne se connecte avec le compte auquel ces demandes appartiennent.
- **Les chauffeurs décident si leurs trajets les rendent repérables, et aucun
  trajet existant n'a été exposé sans qu'on le leur demande.** Tout trajet
  déclaré avant aujourd'hui démarre masqué ; l'interrupteur se trouve sur chaque
  trajet, et les nouveaux sont repérables par défaut.

## [2.34.0] - 2026-09-05 · feat

- **Vous recevez désormais votre reçu dès que vous payez, par e-mail, avec le
  PDF en pièce jointe.** Jusqu'à aujourd'hui, le document n'était produit qu'une
  fois la marchandise livrée, soit plusieurs jours après le débit de votre
  carte, et l'e-mail qui l'annonçait contenait un lien plutôt que le document
  lui-même.
- **Vous pouvez le redemander à tout moment.** Chaque document sous *Mon profil
  → Factures* a un bouton *Envoyer par e-mail* qui l'envoie à l'adresse de votre
  compte. Il ne part jamais qu'à votre propre adresse.
- **Si une demande est annulée et que vous êtes remboursé, vous recevez un
  avoir.** Un document déjà émis et envoyé par e-mail est corrigé par un second
  document plutôt que modifié discrètement, pour que vos écritures et les nôtres
  concordent.
- **Les documents sont en français et disent exactement ce qu'ils sont.** Tant
  que les identifiants légaux de la société sont en cours d'enregistrement,
  chacun est un *reçu de paiement* et l'indique ; il devient une véritable
  *facture*, avec le traitement de la TVA, dès que ces informations sont
  renseignées.
- **Une réservation de test ne produit plus de document marqué « payé ».** Durant
  la phase de test actuelle, aucun argent ne circule réellement, et le document
  le dit au lieu de laisser croire à un débit.
- **Le filtre de période de votre liste de factures fonctionne.** Choisir *Ce
  mois-ci* modifiait le téléchargement groupé mais laissait la liste afficher
  tout.
- **Les conditions de paiement décrivent désormais ce qui se passe vraiment.**
  Elles disaient encore que les fonds étaient bloqués à l'attribution et
  encaissés à la livraison ; vous êtes débité à la confirmation du transport.

## [2.33.0] - 2026-09-05 · feat

- **Il existe désormais une page publique qui liste tout ce qui a changé sur la
  plateforme.** Elle se trouve à l'adresse `/changelog`, est liée depuis le pied
  de page, et se lit en français et en anglais, en clair comme en sombre, comme
  le reste du site.
- **L'historique remonte au premier jour de la plateforme de transport.** Chacune
  des 69 versions depuis l'abandon de la place de marché de marchandises est
  rédigée en langage clair, ce que vous pouvez faire désormais ou quel défaut
  visible a été corrigé, au lieu de rester dans des messages de commit que seul
  un développeur lirait.
- **Plus rien de ce qui modifie la plateforme ne peut être livré sans trace.**
  Une version qui n'apparaît pas sur cette page, avec une fiche technique
  correspondante et un numéro de version concordant, fait désormais échouer le
  build au lieu de partir discrètement.

## [2.32.0] - 2026-08-30 · feat

- **Cherchez sur le tableau des demandes selon le trajet que vous faites
  vraiment.** Indiquez un départ et une arrivée, jusqu'à trois étapes
  intermédiaires, et les jours où vous pouvez rouler. Le tableau répond avec les
  demandes sur votre route et dans votre sens : Bordeaux–Paris vous propose
  Angoulême–Orléans, et jamais l'inverse.
- **Ajouter une étape trouve du travail que la ligne droite manque.** Un trajet
  est traité comme un chemin, pas comme un seul segment : mettre Lyon au milieu
  atteint les demandes situées entre les étapes. La progression est mesurée le
  long de tout le chemin, de sorte qu'on ne vous propose pas un chargement qui
  vous ferait faire demi-tour.
- **Une carte, avec le prix de chaque demande épinglé sur son point
  d'enlèvement et votre trajet tracé en dessous.** Sur ordinateur, vous voyez la
  liste et la carte côte à côte ; sur téléphone, un sélecteur est placé au-dessus
  des deux plutôt qu'enfoui dans la moitié qu'il masque.
- **Les cartes des demandes disent désormais où, avec assez de précision pour
  agir.** La commune, le code postal et la ville que vous connaissez, « à 13 km
  de Clermont-Ferrand », ainsi que toute la fenêtre d'enlèvement, « Entre le
  2 sept. et le 16 sept. », là où seul le premier jour s'affichait et faisait
  passer une quinzaine pour une date fixe.
- **« Voir les courses correspondantes » les affiche enfin, et une recherche peut
  être partagée.** Le tableau ne lisait jamais sa propre adresse : ce lien
  depuis un trajet déclaré produisait donc une recherche que le tableau ignorait
  en silence.
- **Deux défauts qui se produisaient en cours d'usage sont corrigés.** Chercher
  avec la même ville aux deux bouts échouait au lieu de renvoyer des résultats,
  et saisir dans une étape supprimait le champ en cours de saisie, si bien
  qu'une étape ne pouvait jamais être renseignée.

## [2.31.1] - 2026-08-30 · fix

- **Les photos jointes à un signalement d'incident ne sont plus supprimées.**
  Elles étaient rangées à un endroit où le nettoyage hebdomadaire du dimanche ne
  pouvait pas les distinguer des envois abandonnés : chacune aurait donc été
  effacée en moins d'une semaine, alors que c'est justement la preuve sur
  laquelle se plaide un litige pour dommages. Elles sont désormais reconnues et
  conservées.
- **Les pièces d'identité des chauffeurs sont de nouveau stockées en privé.** Sur
  le site en ligne, elles atterrissaient dans le stockage public, accessibles à
  quiconque devinait l'adresse, et soumises au même minuteur de suppression
  hebdomadaire. Elles vont désormais dans le stockage privé, et le système
  refuse de se rabattre sur un stockage public. Rien n'a été perdu : aucun
  document, signalement d'incident ni photo de livraison n'existait sur le site
  en ligne quand cela a été découvert.
- **Les copies de la base de données faites pour les tests ne conservent plus ce
  que les gens ont écrit.** Les descriptions d'incident et notes de résolution,
  les notes de confirmation de livraison et les notes sur les prix proposés dans
  la conversation passaient telles quelles, et le contrôle censé détecter
  précisément cela ne les regardait pas. Les deux couvrent désormais tous les
  champs de texte libre.

## [2.31.0] - 2026-08-30 · feat

- **Les chauffeurs photographient l'enlèvement et la livraison, et le lieu est
  imprimé sur la photo elle-même.** Plusieurs photos par étape, chacune
  estampillée du lieu où elle a été prise avant d'être stockée. Un trajet ne peut
  pas être marqué comme enlevé ou livré sans photo, de sorte qu'il reste
  toujours une trace de ce qui a changé de mains.
- **Le client confirme lui-même l'enlèvement et la livraison.** Depuis
  l'application Expedion, ou en touchant un lien dans le SMS qu'il reçoit déjà,
  sans compte nécessaire. Sa parole est enregistrée séparément de la mise à jour
  du chauffeur, et une confirmation ne déplace jamais à elle seule la demande ni
  l'argent.
- **Toute personne liée à une demande peut signaler un problème.** Dommage,
  retard, difficulté à la porte : décrit, avec photos, et visible de l'équipe
  dans une seule file.
- **Le client paie quand le transport est choisi, pas à la livraison.** Une
  demande directe réclame désormais une carte comme dernière étape lors de sa
  publication ; rien n'est débité à ce moment-là, car le prix est celui que
  proposera le chauffeur retenu.
- **Un chauffeur peut proposer plusieurs créneaux au lieu d'un seul, et
  l'attribution en réserve un.** Quelqu'un de libre le 25 ou le 27 n'a plus à en
  choisir un en espérant que ce soit celui que voulait le client.
- **Un prix peut être envoyé dans une conversation.** Un bouton dans la
  conversation ouvre un court formulaire (prix, date d'enlèvement, date de
  livraison) qui apparaît à côté des messages ordinaires. Sur une demande encore
  ouverte, il compte comme une vraie offre, et l'accepter là est exactement la
  même acceptation qu'ailleurs.

## [2.30.2] - 2026-08-26 · infra

- **Rien de visible ne change** : cette version est un travail de fond, le test
  du journal fait échouer le build sur une migration non enregistrée. Sa raison
  d'être est consignée dans [STATUS.md](./STATUS.md).

## [2.30.1] - 2026-08-26 · ux

- **La liste des clients Expedion se lit correctement, en français et en
  anglais.** Chaque libellé de cet écran (la zone de recherche, le filtre de
  compte, les options de tri, les en-têtes de tableau, le compteur de pages, et
  ce qui s'affiche quand il n'y a rien à montrer ou que la liste ne se charge
  pas) est désormais écrit dans les deux langues, si bien qu'aucun ne retombe sur
  un nom de code brut.
- **La barre latérale nomme votre niveau d'accès avec des mots.** Administrateur,
  Finance, Support, Opérateur, Chauffeur ou Expéditeur, avec « Votre niveau
  d'accès » en dessous, dans la langue que vous utilisez. Les liens des retraits
  et de « Mes gains » sont eux aussi nommés dans les deux langues.

## [2.30.0] - 2026-08-26 · feat

- **Vous pouvez basculer l'application entre le français et l'anglais depuis
  l'en-tête.** Un sélecteur FR | EN figure désormais dans l'en-tête de
  l'application, à la même place et dans le même ordre que sur la page d'accueil
  et l'application Expedion, pour que les trois surfaces se comportent de la même
  façon.
- **Les mises à jour en direct atteignent de nouveau le site en ligne.** Sur le
  site en ligne, chaque page écoutait sur le mauvais nom de canal : les mises à
  jour en temps réel étaient donc refusées d'emblée et n'arrivaient jamais. Les
  pages écoutent désormais là où elles le doivent.
- **Les demandes arrivées par Expedion le signalent sur le tableau des
  demandes.** Le logo et le nom Expedion apparaissent désormais sur le tableau
  des demandes avec un court bandeau expliquant d'où vient la demande, et un lien
  vers Expedion.

## [2.29.0] - 2026-08-26 · ux

- **La barre latérale montre désormais avec quel accès vous êtes connecté.** Un
  accès du personnel est affiché en évidence, un accès ordinaire discrètement, et
  il apparaît de la même manière dans toutes les parties de l'application car il
  provient d'un seul endroit.
- **Les comptes support et finance n'apparaissent plus comme « Expéditeur » dans
  la liste des utilisateurs de l'administration.** Ils étaient étiquetés avec le
  rôle qui revenait en premier de la base de données, ce qui n'a rien d'un ordre
  significatif.
- **Plus de scintillement pendant la connexion.** Le badge reste vide jusqu'à
  l'arrivée effective de la session au lieu d'afficher un texte provisoire, et sa
  ligne garde la même hauteur dans les deux cas, si bien que le menu en dessous
  ne saute pas.

## [2.28.0] - 2026-08-26 · feat

- **Les clients propres à Expedion ont désormais leur propre écran
  d'administration.** Ils n'apparaissaient pas sous Utilisateurs et ne le
  pouvaient pas : ils n'existent que comme propriétaires de devis, et pas un des
  4 592 n'a de fiche de compte de ce côté-ci. Les chercher au mauvais endroit
  ne pouvait pas marcher.
- **La liste est regroupée par client, une ligne chacun, et la recherche se fait
  sur le serveur.** Chercher un numéro de bordereau de livraison retrouve le
  client qui l'a déposé, et les milliers de propriétaires sont paginés depuis le
  serveur au lieu d'être téléchargés dans le navigateur.
- **Un client qui s'est réellement connecté ici affiche un lien vers son compte,
  et ce lien atterrit désormais sur lui.** L'écran Utilisateurs ignorait le
  terme de recherche qu'on lui transmettait, si bien que le lien ouvrait une
  liste non filtrée.
- **Tous les comptes affichaient encore le badge Expeditoo, et c'est un problème
  de réglage, pas un bug.** Le réglage qui marque un compte comme venant de
  l'application Expedion n'est pas activé, si bien que les 28 comptes se lisent
  comme Expeditoo. Il ne ré-étiquette pas les anciens comptes, par conception.
- **L'écran est volontairement en lecture seule.** Les devis se modifient
  toujours sur l'écran Expedion : un second endroit capable d'en changer un,
  c'est ainsi que deux écrans finissent par ne plus s'accorder sur la même
  ligne.

## [2.27.1] - 2026-08-26 · fix

- **« Mes gains » était une page entièrement blanche, et elle se charge
  maintenant.** Deux défauts se cumulaient. Les tables dont l'écran a besoin
  n'avaient en réalité jamais été créées dans la base en ligne, donc chaque
  requête échouait, et quand elle échouait l'écran n'affichait rien du tout :
  ni titre, ni message, rien à relancer. La seule trace se trouvait dans la
  console du navigateur.
- **Un écran de gains en échec dit maintenant ce qui s'est passé et propose de
  réessayer.** Le silence est la raison pour laquelle il a fallu une console de
  développeur pour poser le diagnostic.
- **Prendre une demande d'emblée et demander un versement fonctionnent
  maintenant sur le site en ligne.** Les modifications de base de données
  derrière les deux avaient été écrites des semaines plus tôt mais n'avaient
  jamais été appliquées nulle part : les fonctionnalités existaient dans le code
  et pas dans la base.

## [2.27.0] - 2026-08-26 · feat

- **Les chauffeurs se voient de nouveau dus 90 % de la demande.** La plateforme
  prend un dixième. Le taux avait brièvement affiché 100 % tant que le partage
  n'était pas arrêté ; il l'est désormais.
- **Un chauffeur peut demander à être payé de ce qu'il a gagné.** Une seule
  demande réclame toutes les livraisons gagnées jusque-là et fige le total :
  il n'y a aucun montant à saisir, car une demande partielle obligerait à choisir
  quelles livraisons elle couvre, et un opérateur qui approuve un chiffre doit
  savoir exactement de quelles demandes il s'agit. Une livraison qui survient
  ensuite appartient à la demande suivante, et une seule demande peut être
  ouverte à la fois.
- **La formulation n'implique plus que l'argent arrive instantanément.** Le
  virement est fait hors de l'application par une personne, et l'écran le dit :
  un chauffeur qui attend de l'argent en quelques minutes et patiente deux jours
  a été trompé par l'interface, pas par l'opérateur.
- **Les opérateurs disposent d'une file pour ces demandes, avec trois réponses
  qui veulent dire trois choses différentes.** Approuver dit oui et ne déplace
  rien. Marquer comme payé enregistre que le virement a eu lieu et exige une
  référence à rapprocher. Refuser rend les gains au solde disponible au lieu de
  les faire disparaître.
- **Un seul écran pour les trajets d'un chauffeur, prévus et effectués, plus des
  relevés de gains et des factures téléchargeables par période.** Le côté
  effectué porte l'argent de chaque demande.

## [2.26.0] - 2026-08-26 · feat

- **Un chauffeur peut désormais prendre une demande d'emblée au prix affiché,
  sans offre.** Le prix est celui déjà indiqué sur la demande, il n'y a donc rien
  à remplir : tout l'intérêt est qu'il n'y a pas de négociation. Si deux
  chauffeurs appuient au même instant, le second est informé clairement que
  quelqu'un a été plus rapide, dans sa propre langue.
- **Proposer moins cher existe toujours, et les deux voies figurent sur la page
  de la demande.** Prendre tout de suite vient en premier, et l'option de
  proposer moins est juste à côté. Les véhicules trop petits pour la charge sont
  grisés avec la raison, plutôt que masqués discrètement.
- **Un opérateur peut désormais retirer une demande au mauvais chauffeur.**
  Avant cela, le seul moyen de défaire une attribution était d'annuler la
  demande, ce qui la tuait net : le bon geste quand la demande est abandonnée,
  inutile quand il s'agit de laisser quelqu'un d'autre la prendre. La demande
  retourne sur le tableau des demandes et l'argent du client est d'abord libéré,
  pour que la prochaine attribution ne bloque pas un second montant.
- **Une fois la marchandise enlevée, retirer la demande est refusé.** Un
  enlèvement est un événement réel qu'on ne peut pas défaire depuis un écran ;
  le geste honnête à partir de là est d'annuler et de rembourser.

## [2.25.2] - 2026-08-26 · fix

- **Les chiffres d'affaires des écrans d'administration montrent désormais ce
  qui est réellement arrivé.** Ils n'en rapportaient qu'un dixième, parce que
  chaque paiement enregistrait une part de 90 % due à un chauffeur, part que
  l'entreprise a décidé de ne pas reverser pendant cette phase. L'argent lui-même
  n'a jamais circulé différemment ; seuls les chiffres étaient faux.
- **La plateforme garde pour l'instant la totalité du paiement.** C'est la
  décision du client du 26 août, et elle ne change rien à la circulation de
  l'argent : rien dans le système n'avait jamais transféré automatiquement une
  part à un chauffeur. Un versement n'a toujours été qu'une ligne enregistrée,
  pas un transfert.
- **Une phrase publiée est désormais obsolète.** La page des conditions dit
  encore que la commission est déduite et le solde versé au transporteur ; au
  taux actuel, ce solde est nul. La formulation a été laissée intacte à dessein :
  c'est une décision juridique, pas technique.

## [2.25.1] - 2026-08-26 · fix

- **Le lecteur de secours des documents Expedion fonctionne de nouveau.** Quand
  le lecteur principal est indisponible, le système se rabat sur un second, et ce
  repli échouait en silence depuis des mois parce que le modèle demandé avait été
  retiré. Il demande maintenant un modèle actuel, et quand il échoue il
  enregistre pourquoi (retiré, quota épuisé ou non activé) au lieu de se taire.
- **Les noms de clients enregistrés à l'envers peuvent désormais être
  réparés.** Certains clients étaient stockés avec leur nom de famille dans la
  case du prénom, parce qu'un bordereau de livraison français imprime « DUPONT
  Jean » aussi souvent que « Jean DUPONT ». Le texte d'origine a été conservé, la
  correction le relit donc au lieu de deviner, et elle laisse volontairement de
  côté tout nom qu'une personne a déjà corrigé à la main.
- **Une base de test toute neuve peut désormais illustrer toute la demande, pas
  seulement le tableau.** Jusqu'ici, l'installation pouvait montrer des demandes
  listées mais rien au-delà, faute de moyen de produire un chauffeur approuvé.
  Elle en crée désormais un, avec un véhicule, si bien qu'on peut parcourir
  l'offre, l'attribution et la livraison.

## [2.25.0] - 2026-08-26 · feat

- **Toute personne connectée peut de nouveau demander un transport.** Le
  formulaire de dépôt d'une livraison avait été supprimé quand l'escalade Expedion
  était le seul moyen de faire arriver une demande ; le client l'a redemandé, il
  est donc de retour.
- **Cette fois, le formulaire fonctionne.** Dans la version supprimée, les
  champs de date s'affichaient vides, vider un champ numérique produisait un
  message d'erreur sur zéro, et le bouton qui retire une photo envoyait tout le
  formulaire. Les trois sont corrigés, et le formulaire vérifie désormais les
  mêmes règles d'adresse et de distance que le serveur, au lieu de vous laisser
  envoyer ce qui serait rejeté.
- **Les chauffeurs voient désormais toutes les demandes ouvertes, pas seulement
  celles d'Expedion.** Le tableau était limité aux escalades Expedion et aurait
  masqué toutes ces nouvelles demandes. C'est désormais le tableau de toutes les
  demandes ouvertes, et le compteur du tableau de bord correspond à ce que
  montre la liste.
- **Vous n'avez plus à classer votre demande dans une catégorie.** Quelqu'un qui
  décrit une armoire ne devrait pas avoir à choisir une entrée de nomenclature :
  l'une est donc choisie pour vous.
- **Le formulaire parle français.** La version récupérée était entièrement en
  anglais ; les deux langues sont désormais complètes. Un bouton caché, invisible
  au-dessus de la zone de photos (reste de tests automatisés, capable d'ajouter
  une fausse photo pour qui le trouvait), a été supprimé.

## [2.24.4] - 2026-08-26 · fix

- **Le nom d'un client est désormais lu dans le bon sens sur le bordereau.** Les
  bordereaux français impriment « DUPONT Jean » au moins aussi souvent que « M.
  Jean DUPONT », et le nom de famille atterrissait dans le champ du prénom pour
  à peu près la moitié d'entre eux. Le nom est désormais lu selon la façon dont
  il est imprimé, et un nom de famille composé comme « DE LA TOUR » reste
  entier.
- **Une entreprise ne se voit plus attribuer un prénom inventé.** Un bordereau
  établi au nom d'une société est reconnu comme tel et conservé sous un seul nom
  plutôt que coupé en deux.
- **Un nom qui ne peut pas être lu avec certitude est laissé tel quel.** Quand la
  lecture est incertaine, rien n'est écrit : un nom qu'un opérateur a corrigé à
  la main n'est donc jamais écrasé par une supposition, et le prénom d'une
  personne n'est jamais associé au nom d'une entreprise.

## [2.24.3] - 2026-08-26 · fix

- **Les clients Expedion peuvent de nouveau joindre un bordereau.** Le dépôt du
  bordereau échouait pour tous les comptes créés depuis le changement de
  connexion, et le formulaire de devis ne se valide pas sans lui : les nouveaux
  clients ne pouvaient donc pas demander de devis du tout. Les envois vont
  désormais vers le stockage propre à cette application et le formulaire aboutit.
- **Ces documents sont privés.** Un bordereau n'est servi qu'à la personne qui
  l'a déposé ou à un administrateur, par un lien qui expire au bout de cinq
  minutes. Toute autre personne apprend simplement que le fichier n'existe pas,
  si bien qu'un inconnu ne peut même pas savoir s'il est là.
- **Les bordereaux déposés à l'ancienne s'ouvrent toujours.** Rien de ce qui
  était déjà stocké n'a été déplacé, modifié ni supprimé.

## [2.24.2] - 2026-08-26 · fix

- **Les clients Expedion revoient leur propre historique de devis.** Quiconque se
  connectait via le système de comptes partagé obtenait une liste vide et aucun
  message d'erreur, alors que ses devis étaient tous toujours là. Les anciens
  devis sont désormais rattachés au compte à l'inscription *et* à chaque
  connexion, si bien qu'un compte existant les récupère enfin.
- **Se connecter avec un compte Google professionnel ne mène plus à une impasse.**
  Un compte Google sur un domaine qui ne déclare pas l'adresse comme vérifiée
  tombait sur « compte non lié », sans moyen de s'en sortir. Google est
  désormais considéré comme fiable pour lier ces comptes entre eux.
- **Les e-mails d'Expedion ressemblent à Expedion et se comportent comme lui.**
  Les e-mails de vérification et de réinitialisation de mot de passe portaient la
  marque EXPEDITOO et envoyaient tout le monde vers la page de connexion des
  chauffeurs. Ils prennent désormais la marque et la destination de
  l'application dans laquelle le compte a été créé. Le lien de réinitialisation
  lui-même s'ouvre toujours ici, volontairement, car c'est la seule application
  avec une page de réinitialisation.
- **Une erreur de configuration silencieuse qui avait cassé la connexion Google
  est désormais détectée avant la mise en ligne.** Les deux applications sont
  protégées par quatre listes d'adresses approuvées distinctes, et l'une était
  désynchronisée, si bien que la fenêtre de connexion était refusée. Un contrôle
  tourne désormais à chaque modification et chaque nuit.

## [2.24.1] - 2026-08-23 · fix

- **Un opérateur peut de nouveau saisir un prix manquant sur un devis payé.**
  Certains devis importés arrivaient déjà payés mais sans prix enregistré, et ils
  ne peuvent jamais être publiés sans. Le champ pour le saisir était masqué
  précisément sur ces devis, et tout ce qu'on y tapait était perdu à
  l'enregistrement. Il fonctionne désormais, et les deux montants publiés à côté
  restent en lecture seule.
- **Rouvrir un devis payé ne le piège plus.** Un devis qu'un opérateur avait
  volontairement rouvert pouvait être discrètement remarqué comme payé dans son
  dos et se retrouver dans un état sans aucun bouton et sans issue. Ce
  changement est désormais refusé net au lieu d'être appliqué à moitié.
- **« Assigner un chauffeur » n'apparaît plus sur les devis qui ne peuvent pas
  recevoir de chauffeur.** Le menu le proposait sur chaque devis bloqué de la
  file, tous, alors qu'appuyer dessus n'aurait fait qu'échouer. Un devis bloqué
  affiche désormais un seul bouton Corriger et ne propose rien que le système
  refuserait.

## [2.24.0] - 2026-08-23 · feat

- **Un devis payé devient une décision que prend un opérateur, et non plus un
  compte à rebours qu'il surveille.** La ligne affiche « Sans chauffeur »,
  indique dans combien de temps le minuteur le publierait de lui-même, et
  propose les deux voies sous forme de boutons : confier la demande à un
  chauffeur du vivier, ou la publier et laisser les transporteurs faire des
  offres.
- **Confier une demande à un chauffeur du vivier atteint désormais réellement ce
  chauffeur.** Auparavant, l'action écrivait quelques champs puis s'arrêtait.
  Elle produit maintenant exactement ce que produit la victoire d'une enchère :
  la demande, l'offre, le suivi de livraison et le paiement. Les deux voies
  aboutissent donc au même endroit.
- **Le prix n'est plus modifiable une fois que le client a payé.** « Ajuster le
  prix » ne figure plus dans le menu d'un devis réglé, et une relecture du
  bordereau en arrière-plan ne peut plus le réécrire. Corriger un prix
  réellement payé passe par l'annulation puis un nouveau devis, qui rouvre le
  devis et affiche la référence du paiement ; aucun argent ne bouge ici, car ce
  paiement a été encaissé dans l'application Expedion.
- **Des devis apparaissaient comme à publier plusieurs heures trop tôt.** Le
  tableau de bord et le publieur automatique n'étaient pas d'accord sur un même
  devis selon l'horloge du serveur. Ils lisent désormais les mêmes heures.
- **La file « sans chauffeur » était surtout remplie de demandes qui n'en
  avaient pas besoin.** Elle listait plus de mille livraisons importées, déjà
  récupérées en dehors du système ; elle n'affiche plus que les 42 qui
  attendent vraiment.
- **Un client est désormais prévenu de qui a remporté sa demande.** L'attribution
  d'un devis escaladé se heurtait à une incohérence interne passée sous silence :
  l'attribution aboutissait, mais le devis restait indéfiniment « escaladé » et
  le client n'était informé de rien. Le gagnant est maintenant enregistré et
  affiché dans la chronologie.

## [2.23.0] - 2026-08-22 · feat

- **Chaque bouton de la page d'accueil mène désormais quelque part.** Saisir une
  offre dans la carte de démonstration ou appuyer sur « offrir » sur une ligne de
  demande ne faisait rien, ou vous renvoyait vers un formulaire d'inscription qui
  avait oublié ce que vous aviez fait. Chacun valide, confirme et vous amène au
  bon endroit, et les pages de connexion et d'inscription vous rappellent ce que
  vous étiez en train de faire à votre arrivée.
- **Les chauffeurs qui ont déjà utilisé ce navigateur sont dirigés vers la
  connexion, pas vers l'inscription.** Le site se souvient qu'un compte a déjà
  servi ici : revenir après une déconnexion ne vous invite donc plus à en créer un
  second.
- **La carte d'offre de démonstration vérifie correctement votre prix.** Elle
  refuse tout montant inférieur à 50 € ou qui ne fait pas mieux que le prix déjà
  affiché, se met à trembler, s'explique et conserve ce que vous avez saisi au
  lieu d'échouer en silence.
- **Les dix liens du pied de page ouvrent désormais une vraie page.** Contact,
  mentions légales, vérification et maisons de ventes ont été ajoutés. Le
  formulaire de contact transmet votre message à l'équipe, et le dépose dans
  votre propre conversation d'assistance si vous en avez déjà une.
- **S'inscrire comme chauffeur ne demande plus de Kbis.** Un entrepreneur
  individuel n'en a pas, et la page de vérification indiquait déjà que ce n'était
  pas exigé : elle demande désormais le SIRET. Les trois exemples de demandes de
  la page d'accueil sont aussi présentés comme des exemples, pour que personne ne
  les prenne pour de vraies missions.

## [2.22.0] - 2026-08-22 · feat

- **Un message envoyé depuis l'application Expedion atteint désormais une vraie
  personne et reçoit une réponse.** Le formulaire de contact écrivait dans un
  tableur séparé sans retour possible : la personne qui écrivait ne savait jamais
  si quelqu'un l'avait lu. Il ouvre maintenant une vraie conversation dans la
  même boîte d'assistance que le chat du site, traitée de la même manière.
- **Une personne, une seule conversation, à nouveau.** Quiconque avait déjà écrit
  à un transporteur obtenait une nouvelle conversation d'assistance à chaque
  visite : la boîte d'assistance montrait la même personne comme plusieurs
  conversations sans lien.
- **La boîte d'assistance ne plante plus à la deuxième visite.** Dès qu'un membre
  de l'équipe avait rejoint une conversation et l'avait lue, revenir à la boîte
  ne la chargeait plus du tout. Elle s'ouvre maintenant à chaque fois.
- **Les conversations d'assistance sont réservées à l'équipe.** N'importe quel
  compte connecté — un chauffeur, par exemple — pouvait lire toutes les
  conversations d'assistance de la plateforme, y compris les noms, adresses
  e-mail et messages des autres. L'accès est désormais limité aux administrateurs
  et au personnel d'assistance.

## [2.21.0] - 2026-08-22 · feat

- **Le tableau de bord Expedion se met désormais à jour tout seul.** Un nouveau
  devis, un paiement, une modification par un autre opérateur, un prix
  automatique, une escalade ou un changement de statut remonté par un chauffeur
  apparaît sur un tableau de bord déjà ouvert, sans avoir à actualiser.
- **Tous les opérateurs sont concernés, pas seulement celui qui a fait le
  changement.** Vérifié avec deux sessions côte à côte : un devis créé dans un
  onglet est apparu dans le tableau de bord ouvert de l'autre, sans rechargement.
- **Une connexion en direct interrompue ne peut rien casser.** La mise à jour en
  direct est faite au mieux : si le signal échoue, l'enregistrement sous-jacent
  aboutit quand même et le tableau de bord se comporte comme avant — une
  actualisation fait apparaître le changement.

## [2.20.0] - 2026-08-21 · ux

- **« À traiter » place maintenant le devis le plus récent en haut.** Il classait
  auparavant selon l'urgence de chaque type d'élément puis, à urgence égale, du
  plus ancien au plus récent : une demande arrivée il y a quelques minutes
  pouvait donc se trouver sous une demande vieille de plusieurs jours. La liste
  se lit désormais du plus récent au plus ancien.
- **Tous les onglets du panneau trient de la même façon.** Passer d'un onglet à
  l'autre ne remélange plus la liste dans un ordre différent.

## [2.19.3] - 2026-08-21 · fix

- **Ouvrir un devis n'efface plus la page.** Certains devis contenaient une photo
  que l'écran ne savait pas lire, et il suffisait d'en ouvrir un pour que toute
  la page devienne blanche, sans autre issue qu'un rechargement. Les entrées
  défectueuses sont désormais ignorées et le devis s'ouvre normalement.
- **Une défaillance inattendue affiche maintenant un message et un bouton pour
  réessayer.** Partout dans l'application, un plantage laissait un écran vide
  sans explication ; il y a désormais un écran d'erreur avec un moyen de
  réessayer.

## [2.19.2] - 2026-08-20 · infra

- **Rien de visible ne change** — cette version prépare le terrain : Tests pour
  geocodeMissingCoordinates. Sa raison d'être est consignée dans
  [STATUS.md](./STATUS.md).

## [2.19.1] - 2026-08-20 · fix

- **Un devis est prêt pour la carte dès qu'il a une adresse.** Les devis dont la
  taille et le poids n'étaient pas encore renseignés restaient sans position sur
  la carte, ce qui les empêchait d'être publiés aux chauffeurs tant qu'un
  opérateur n'avait pas saisi les dimensions à la main. L'adresse seule suffit
  désormais à placer les deux repères.
- **Corriger une adresse déplace le repère avec elle.** Modifier une adresse de
  retrait ou de livraison laissait la carte pointer sur l'ancien emplacement ;
  le repère obsolète est maintenant supprimé aussitôt, puis remplacé une fois la
  nouvelle adresse retrouvée.

## [2.19.0] - 2026-08-20 · feat

- **Un devis lit maintenant ses propres documents dès son arrivée.** Quand un
  client soumet un devis avec un bordereau de transport joint, le système en
  extrait immédiatement les informations au lieu d'attendre qu'un opérateur
  appuie sur un bouton. Il ne remplit que les champs encore vides : rien de ce
  que le client a saisi lui-même n'est écrasé.
- **L'écran du devis vous prévient quand une lecture est prête.** Un devis en
  attente s'ouvre désormais avec une bannière en haut annonçant ce qui a été
  extrait, avec un raccourci « Vérifier maintenant » vers la modification, au
  lieu de rester enfoui plus bas dans la page.
- **Le sélecteur d'adresse affiche de vrais mots à nouveau.** Les champs code
  postal et ville affichaient des libellés internes de remplacement au lieu de
  textes français ou anglais, ce qui donnait l'impression qu'ils se
  superposaient. Les deux langues sont corrigées.
- **Le bouton de fermeture ne se superpose plus aux autres boutons.** La croix de
  fermeture de la fenêtre chevauchait la rangée de boutons de l'en-tête du devis ;
  elle fait maintenant partie de cette rangée et ne peut plus entrer en
  collision avec elle.
- **La fenêtre du devis peut passer en plein écran.** Modifier deux cartes et un
  long formulaire dans une petite fenêtre était à l'étroit : il y a désormais un
  contrôle pour agrandir et restaurer, sur ordinateur comme sur mobile.

## [2.18.1] - 2026-08-20 · infra

- **Rien de visible ne change** — cette version prépare le terrain : Suppression
  de deux avertissements exhaustive-deps dans QuoteDetailDialog. Sa raison d'être
  est consignée dans [STATUS.md](./STATUS.md).

## [2.18.0] - 2026-08-20 · feat

- **Un devis qui ne peut pas être publié peut maintenant être corrigé dans la
  page plutôt que dans la base de données.** Les lignes sans coordonnées, sans
  adresse, sans poids ou sans prix convenu affichaient un bouton Publier grisé,
  sans moyen de savoir ce qui n'allait pas. Publier ouvre désormais le devis en
  mode modification, avec une liste de contrôle en direct de ce qui manque
  exactement, une carte pour placer les points de retrait et de livraison, et un
  champ pour le prix convenu.
- **Corriger un devis n'efface plus son poids ni sa taille.** Enregistrer le
  formulaire du devis réécrivait un poids, une longueur, une largeur et une
  hauteur vides, même quand ces champs n'avaient pas été touchés.
- **Les compteurs de qualité des données sont cliquables.** Les tuiles comptant
  les devis sans coordonnées ou sans dimensions mènent désormais directement à la
  liste de ces devis au lieu de se contenter d'afficher le nombre.
- **Les conditions de gardiennage peuvent enfin être modifiées.** La file de
  gardiennage a une fenêtre pour prolonger une période gratuite ou changer le
  tarif journalier — la modification était toujours acceptée en coulisses, il
  n'existait simplement aucun écran pour la faire.

## [2.17.0] - 2026-08-20 · feat

- **Un client qui attend un devis peut maintenant voir une estimation de prix par
  IA pendant que le devis est encore en cours de chiffrage.** La même analyse que
  voit un opérateur lors d'un nouveau chiffrage — un prix standard, un prix
  assuré et le raisonnement qui les sous-tend — est désormais disponible pour
  l'application Expedion. Elle est calculée une seule fois puis mémorisée : rouvrir
  l'écran ne la recalcule pas, et elle n'est plus proposée dès que le devis a un
  vrai prix.
- **Corriger un devis supprime une estimation périmée.** Modifier le poids, les
  dimensions ou l'un des codes postaux efface l'ancien chiffre de l'IA, au lieu de
  laisser à l'écran un nombre fondé sur des valeurs que vous venez de changer.
- **Un opérateur peut maintenant corriger les détails d'un devis dans la page.**
  Le panneau du devis était en lecture seule ; il a désormais un mode
  modification couvrant l'identité et l'adresse du client, le retrait, la
  livraison et la marchandise, enregistré par la route du personnel, qui laisse
  une trace d'audit, plutôt que par l'écran de confirmation des détails du
  client — qu'un devis importé sans compte client ne pouvait jamais atteindre.
- **Le personnel peut relire le document téléversé d'un devis.** Pour un client
  qui a téléversé un bordereau sans jamais finir de confirmer les détails, un
  opérateur peut relancer l'analyse sur le document stocké. Elle ne remplit que
  les blancs : tout ce qui a déjà été corrigé à la main est laissé tel quel.
- **Les listes d'administration peuvent être filtrées par période.**
  Aujourd'hui, hier, les 7 ou 30 derniers jours, ce mois-ci, ou une période de
  votre choix — sur les candidatures de transporteurs, les livraisons, les
  demandes et les utilisateurs. Le bouton indique la période sélectionnée plutôt
  que d'afficher deux dates brutes.

## [2.16.1] - 2026-08-20 · fix

- **Les montants en euros élevés sont de nouveau lisibles.** Le séparateur de
  milliers était une espace très fine que de nombreuses polices n'affichent pas
  du tout : un montant s'imprimait donc en une suite ininterrompue de chiffres et
  se lisait facilement avec un facteur mille d'erreur. Les montants s'affichent
  maintenant avec un point visible — 189.543,65 €.
- **Chaque montant est désormais formaté de la même façon.** Les tableaux de bord,
  la file d'attribution, les paiements, les cartes de demandes et d'offres, les
  factures et le SMS reçu par le client affichent tous l'argent de manière
  identique : un même nombre ne peut plus sembler différent selon l'écran où vous
  vous trouvez.

## [2.16.0] - 2026-08-20 · ux

- **Les écrans d'administration les plus récents se lisent correctement en
  français comme en anglais.** Les fenêtres « Se connecter en tant que » et de
  modération de compte, le filtre « Tous les statuts » des candidatures de
  transporteurs, et la nouvelle liste de travail des devis récents — ses onglets,
  ses badges de prochaine étape et ses libellés d'aperçu de documents — ont tous
  un vrai texte dans les deux langues.
- **Les deux langues comportent exactement le même ensemble de textes.**
  Vérifié entrée par entrée plutôt qu'à l'œil — 1 340 de chaque côté, sans rien
  de présent dans une langue et absent de l'autre.

## [2.15.1] - 2026-08-20 · fix

- **Le logo EXPEDITOO garde désormais les mêmes proportions partout où il
  apparaît.** Le symbole et le logotype à côté étaient dimensionnés séparément :
  le même ensemble donnait donc une forme nettement différente dans l'en-tête
  mobile et dans la barre de navigation de la page d'accueil. Chacun de ses
  éléments — tailles de texte, espacement, arrondi des coins — évolue maintenant
  ensemble à partir d'une seule taille.

## [2.15.0] - 2026-08-20 · feat

- **Le tableau de bord opérateur ne se fige plus au chargement.** Il demandait à
  la base de données dix-huit choses à la fois, et dès que cela dépassait ce que
  la connexion pouvait servir, la page restait à charger indéfiniment au lieu
  d'échouer. Il se charge maintenant en trois vagues plus petites, et un chiffre
  qui échoue ne vous coûte que cette carte-là, pas toute la page.
- **Les devis récents deviennent une liste de travail, placée en haut de la
  page.** Passez de ceux qui attendent encore quelqu'un à tous les devis, les plus
  urgents d'abord. Chaque ligne en attente dit ce qu'elle attend et porte le
  bouton qui le fait — Chiffrer, Affecter un chauffeur ou Publier — de sorte que
  le libellé et le bouton ne peuvent jamais se contredire.
- **Ouvrir un devis affiche maintenant les coordonnées du client et ses
  documents.** Le bordereau et les photos téléversés par le client s'affichent en
  aperçu dans le panneau au lieu d'être un lien à ouvrir ailleurs.
- **La barre latérale et le menu mobile affichent des compteurs.** En rouge quand
  du travail attend le personnel, en gris pour le volume, actualisés environ une
  fois par minute — pour voir ce qui demande de l'attention sans ouvrir chaque
  page.

## [2.14.1] - 2026-08-20 · ux

- **L'ouverture des candidatures de chauffeurs affiche désormais toutes celles qui
  attendent une vérification.** La page s'ouvrait auparavant sur un seul statut :
  une candidature dans un autre état restait invisible à moins de savoir déjà
  qu'il fallait élargir le filtre.
- **Les candidatures les plus récentes sont en haut.** Maintenant que la page
  s'ouvre sur la file complète plutôt que sur une courte tranche, elle est
  classée du plus récent au plus ancien.
- **Le filtre de statut fonctionne exactement comme avant.** Tous les statuts
  restent proposés pour affiner — il n'est simplement plus appliqué à votre place,
  « Tous les statuts » servant de point de départ.

## [2.14.0] - 2026-08-20 · feat

- **Un administrateur peut maintenant se connecter en tant qu'un autre
  utilisateur pour voir exactement ce qu'il voit.** La session empruntée dure une
  heure, affiche une bannière tant qu'elle est active et est enregistrée : on sait
  toujours qui a consulté quoi, et quand.
- **Suspendre un compte fait enfin quelque chose, et couper un accès prend
  quelques minutes au lieu d'une semaine.** Marquer quelqu'un comme suspendu ne
  changeait rien du tout — la personne pouvait toujours se connecter normalement ;
  cela bloque désormais les nouvelles connexions et met fin aux sessions déjà
  ouvertes, et une déconnexion ou une suspension prend effet en cinq minutes
  environ, au lieu de passer inaperçue jusqu'à sept jours.
- **Davantage d'actions sont possibles depuis la liste des utilisateurs.** Vous
  pouvez voir la dernière connexion de quelqu'un, ouvrir son profil, lui envoyer
  une réinitialisation de mot de passe, le déconnecter partout ou supprimer le
  compte — et quand une action n'est pas autorisée, le menu vous explique
  pourquoi au lieu de masquer discrètement l'option.
- **Consulter le compte de quelqu'un ne le modifie jamais.** Tant qu'un
  administrateur voit l'application comme une autre personne, rien n'est écrit en
  son nom : ses messages ne sont pas marqués comme lus et aucun moyen de paiement
  n'est configuré à son nom.
- **Un compte suspendu ou non vérifié reste consultable par l'administrateur qui
  doit le voir**, au lieu d'être inaccessible à la seule personne qui essaie de
  régler la situation.
- **La liste des utilisateurs distingue désormais une inscription EXPEDITOO d'une
  inscription Expedion** — mais uniquement pour les comptes créés à partir de
  maintenant, car rien dans les données n'indique d'où venait un compte plus
  ancien et deviner aurait eu tort plus souvent que raison.

## [2.13.6] - 2026-08-20 · infra

- **Rien de visible ne change** — cette version prépare le terrain : APP_ENV,
  garde-fous de base de données fermés par défaut et miroir anonymisé. Sa raison
  d'être est consignée dans [STATUS.md](./STATUS.md).

## [2.13.5] - 2026-08-19 · fix

- **Un prix publié par un opérateur peut maintenant réellement être accepté.** Le
  client voyait le prix, puis obtenait une erreur dès qu'il essayait de
  l'accepter. Publier le prix fait désormais passer le devis à l'étape où
  l'acceptation est autorisée.
- **Un devis chiffré ne disparaît plus de toutes les files.** Il sortait de la
  liste « à chiffrer » sans arriver nulle part ailleurs : plus personne dans
  l'équipe ne le surveillait.
- **Corriger le prix d'une demande déjà acceptée ou payée ne la fait pas reculer.**
  L'étape n'avance que depuis les deux points où cela a du sens.

## [2.13.4] - 2026-08-19 · fix

- **Recevoir le rôle d'administrateur donne maintenant réellement accès au
  tableau de bord d'administration.** Un compte pouvait recevoir l'accès
  administrateur sans voir aucun lien d'administration nulle part : l'application
  n'arrivait pas du tout à charger les permissions de cette personne et la
  considérait comme n'en ayant aucune.
- **Les anciens libellés d'accès de la version précédente n'écrasent plus les
  vrais.** Quelques comptes portaient encore des libellés qui ne signifiaient plus
  rien depuis le retrait de la place de marché, et un seul d'entre eux suffisait
  à masquer toutes les vraies permissions de la personne.
- **Dix comptes ont été nettoyés.** Les libellés obsolètes ont été supprimés ;
  ils ne donnaient aucun droit, et toute personne qui n'en a plus retombe sur le
  rôle par défaut habituel.

## [2.13.3] - 2026-08-16 · infra

- **Les écrans qui échouaient complètement se chargent de nouveau.** Le tableau
  des demandes, les livraisons, la file d'attribution et les écrans d'argent de
  l'administration renvoyaient tous une erreur, parce que la base de données avait
  encore la forme de l'ancienne version de place de marché alors que
  l'application attendait la nouvelle. Une première tentative de mise à jour
  s'était arrêtée à la première valeur incorrecte et s'était entièrement
  annulée : rien n'était donc à moitié modifié — cela n'avait simplement pas
  encore eu lieu.
- **Rien n'a été perdu côté Expedion.** Les 4 592 devis sont passés intacts, de
  même que chaque compte, offre, profil de chauffeur, véhicule et conversation.
- **Les derniers restes de l'ancienne version de place de marché ont disparu.**
  Une poignée de demandes, de transports et de paiements obsolètes de l'ancien
  produit ont été supprimés, ainsi que sept éléments résiduels de la base de
  données dont plus rien ne se sert.

## [2.13.2] - 2026-08-16 · fix

- **La connexion sur le site en ligne fonctionne de nouveau.** Le site s'était mis
  à refuser les tentatives de connexion provenant de sa propre adresse web, avec
  un message « Invalid origin » qui ressemblait à un plantage, et le bouton Google
  échouait avant même d'atteindre Google.
- **L'adresse que les gens utilisent réellement est maintenant approuvée
  automatiquement.** Quelle que soit l'adresse sur laquelle un déploiement est
  servi — l'adresse en ligne ou une adresse de test temporaire — la connexion y
  fonctionne, sans que personne ait à penser à mettre d'abord un réglage à jour.
- **La connexion Google sur une adresse toute neuve demande encore une étape
  manuelle de la part de l'équipe.** Tant que la nouvelle adresse n'est pas
  enregistrée des deux côtés, le bouton Google ne fonctionnera pas ; la connexion
  ordinaire par e-mail n'est pas affectée.

## [2.13.1] - 2026-08-16 · fix

- **Six écrans qui n'affichaient qu'une erreur fonctionnent maintenant.** Les
  livraisons, la file d'attribution et les listes d'administration des demandes,
  des transports et des paiements échouaient complètement. Les données stockées
  avaient encore la forme de l'ancien produit d'enchères de marchandises : tout
  ce qui cherchait une demande de transport plantait.
- **Rien dont quelqu'un dépende n'a été perdu.** Les comptes, rôles, offres,
  chauffeurs, véhicules et les 4 591 devis Expedion importés sont intacts. Les
  seuls enregistrements supprimés sont 31 anciennes annonces d'enchères et une
  poignée de lignes associées du produit retiré, dont aucune n'était rattachée à
  une demande de transport.
- **Quatre pages mortes supprimées.** Un espace réservé vide pour des
  « rapports », une page de profil public, une FAQ et un écran de démarrage
  n'avaient aucun lien pointant vers eux depuis l'application.

## [2.13.0] - 2026-08-16 · feat

- **Expeditoo est désormais l'application du chauffeur.** Les écrans pour publier
  soi-même une demande de transport ont disparu — le formulaire de demande en
  quatre étapes, sa page de confirmation et la liste « mes demandes ». Le travail
  arrive désormais d'Expedion, et l'ancien lien « mes demandes » vous mène au
  nouveau tableau des demandes.
- **L'écran d'accueil est un tableau de bord du chauffeur.** Il montre où en est
  votre candidature, la course en cours, les demandes ouvertes aux offres et vos
  offres encore en attente d'une décision.
- **Un tableau des demandes qui n'affiche que le travail d'Expedion.** Le tableau
  a déménagé sur sa propre page et se limite aux demandes venues d'Expedion : rien
  d'autre ne l'encombre — et il se lit désormais en français ou en anglais, alors
  qu'il n'était qu'en anglais auparavant.
- **Un opérateur attribue les demandes escaladées, depuis une seule file.** Ces
  demandes appartiennent à Expedion et non à une personne qui pourrait se
  connecter et choisir : c'est donc un opérateur ou un administrateur qui désigne
  le gagnant — depuis la page de la demande ou depuis une nouvelle file
  d'attribution. Le client qui a payé est celui qui est débité, jamais l'opérateur
  qui a cliqué.
- **Postuler comme chauffeur ne demande plus de document d'immatriculation
  d'entreprise.** Un entrepreneur individuel n'en a pas. Un numéro SIRET et un
  véhicule restent exigés, le véhicule parce que votre offre doit nommer celui qui
  effectuera la mission.
- **Attribuer un rôle dans le panneau d'administration fonctionne.** Transporteur,
  chauffeur, expéditeur, support et finance étaient tous refusés comme invalides,
  et la seule option que le formulaire acceptait échouait ensuite à
  l'enregistrement. Tous peuvent maintenant être attribués.

## [2.12.0] - 2026-08-16 · feat

- **Un seul écran opérateur pour toute la plateforme.** La page d'administration
  Expedion et l'ancien tableau de bord d'administration ne forment plus qu'une
  seule page : six chiffres clés, l'entonnoir des devis, et des cartes sur l'offre
  de chauffeurs et la qualité des données — le tout alimenté depuis un seul
  endroit, de sorte que deux chiffres de la page ne peuvent jamais se
  contredire.
- **Quatre files de travail que vous pouvez vider sans quitter la page.** Devis à
  chiffrer, devis sans chauffeur, gardiennage à risque et escalade due, avec le
  nouveau chiffrage, l'affectation d'un chauffeur et l'escalade vers la place de
  marché effectués directement sur la ligne, au lieu d'un aller-retour par une
  page de détail pour chaque devis.
- **Escalader un devis demande une confirmation et refuse quand cela ne peut pas
  fonctionner.** L'escalade est irréversible : elle se place donc derrière une
  confirmation, et le bouton est tout bonnement désactivé quand le lieu de retrait
  n'a pas de coordonnées — précisément ce qui aurait fait échouer l'escalade de
  toute façon.
- **L'écran opérateur parle votre langue.** Il ne pouvait s'afficher qu'en
  français, quelle que soit la langue du reste de l'application. Il est
  maintenant complet en français et en anglais.
- **L'argent de cette page est indiqué comme provisoire, parce qu'il l'est.** Les
  paiements fonctionnent encore en mode test et les versements ne quittent jamais
  l'état « programmé » : les chiffres sont donc des indicateurs et non des
  comptes.
- **Les anciens liens mènent toujours quelque part d'utile.** L'ancien tableau de
  bord d'administration, et les cinq liens qui y pointaient, vous amènent
  désormais ici.

## [2.11.1] - 2026-08-16 · fix

- **« Mes devis » n'affiche plus à un opérateur les devis de tous les clients.**
  Un compte disposant de droits d'opérateur qui ouvrait sa propre liste de devis
  dans l'application Expedion recevait la table entière — 4 591 devis
  appartenant à tout le monde — avec des compteurs qui totalisaient toute la
  plateforme et un champ bordereau qui cherchait parmi les clients des autres.
  Elle ne renvoie désormais que les devis de la personne connectée.
- **« Mes paiements » ne présente plus le chiffre d'affaires de l'entreprise
  comme les gains d'une seule personne.** Pour un opérateur, la page
  additionnait l'argent de toute la plateforme comme s'il s'agissait du sien.
- **Voir l'ensemble des devis est désormais une demande explicite.** Une vue
  large sur tous les devis doit être demandée expressément et exige des droits
  d'administrateur ; un appelant qui la réclame sans ces droits reçoit un refus,
  au lieu de se voir remettre discrètement ses seuls devis en croyant avoir tout
  vu.
- **Rien à mettre à jour dans l'application Expedion.** Toute la correction se
  trouve de notre côté — l'application n'a jamais envoyé d'identifiant
  d'utilisateur, seulement sa connexion.

## [2.11.0] - 2026-08-14 · ux

- **L'application s'ouvre désormais dans le thème de votre téléphone.** Elle
  démarrait toujours en mode clair, quel que soit le réglage de l'appareil. Elle
  suit maintenant l'appareil, et un thème que vous choisissez vous-même reste
  prioritaire.
- **L'application s'ouvre désormais dans la langue de votre appareil.** Toute
  personne qui n'avait jamais choisi de langue obtenait le français. Un appareil
  en anglais obtient l'anglais, et le français reste la langue de repli pour un
  appareil qui demande une langue que l'application ne propose pas.
- **Le réglage du thème n'affiche plus brièvement la mauvaise option cochée au
  démarrage.** Avant la fin du chargement de la page, le sélecteur marquait un
  instant « clair » comme votre choix, même quand ce n'était pas le cas.

## [2.10.3] - 2026-08-14 · infra

- **De nouvelles versions de l'application peuvent de nouveau être publiées.**
  Chaque tentative de mise en ligne d'une mise à jour était rejetée avant même
  de démarrer, sur tous les comptes essayés, parce que l'offre sur laquelle
  tourne l'application n'autorise pas les tâches automatiques en arrière-plan
  plus d'une fois par jour — or l'application en a besoin de quatre. Ces tâches
  s'exécutent maintenant ailleurs et les mises à jour partent normalement.
- **Les tâches automatiques en arrière-plan gardent leur ancien calendrier.**
  Les demandes expirées sont toujours balayées toutes les 15 minutes, les devis
  Expedion payés sont toujours vérifiés pour l'escalade toutes les 10 minutes,
  l'expiration des documents des chauffeurs se vérifie une fois par jour et le
  nettoyage des images une fois par semaine.
- **Une exécution en arrière-plan qui échoue n'est pas relancée
  automatiquement.** Ces tâches envoient des e-mails et modifient des
  enregistrements liés aux paiements : une exécution à moitié terminée n'est
  donc jamais rejouée — elle reste visiblement en échec, et la prochaine
  exécution planifiée reprend le travail.

## [2.10.2] - 2026-08-14 · fix

- **C'est désormais votre propre connexion qui prouve qui vous êtes sur les
  écrans de devis Expedion.** L'application présentait un secret partagé
  accompagné d'un identifiant client déclaré, et quiconque détenait ce secret
  pouvait réclamer les devis de n'importe qui. Le compte connecté est maintenant
  vérifié en premier, et rien sur votre identité n'est pris sur la seule parole
  de l'application.
- **L'accès opérateur suit le rôle de votre compte, pas le secret que vous
  présentez.** Savoir si un appelant compte comme administrateur se décide
  d'après le même rôle d'administrateur que lit le reste de l'application, au
  lieu de se déduire de la clé jointe à la requête.
- **L'ancienne application Expedion continue de fonctionner sans changement.**
  Les appelants sans connexion — la version précédente du client et les tâches
  automatiques en arrière-plan qui nous contactent directement — passent
  toujours par la clé partagée : rien n'a eu à être mis à jour de leur côté.

## [2.10.1] - 2026-08-14 · fix

- **Un chauffeur peut maintenant démarrer la mission qu'il a remportée.**
  Remporter une offre créait la livraison mais la laissait bloquée : aucun
  bouton ne permettait de la commencer, et le transporteur retenu était
  carrément exclu de l'espace chauffeur. Les transporteurs approuvés sont
  désormais configurés pour effectuer leurs propres missions, les missions en
  attente de départ apparaissent dans la liste du chauffeur, et une action «
  Démarrer cette mission » les fait avancer.
- **La réinitialisation du mot de passe fonctionne de nouveau.** Demander à
  réinitialiser son mot de passe envoyait l'e-mail de vérification du compte, et
  le lien qu'il contenait ne permettait pas de terminer la réinitialisation. La
  réinitialisation a maintenant son propre message et son propre lien.
- **La progression de la livraison est de nouveau lisible.** L'étape mise en
  avant dans la chronologie de livraison était blanc sur blanc, si bien qu'on ne
  voyait pas où en était une mission. Les mêmes couleurs invisibles touchaient
  des badges à quatorze endroits de l'application.
- **Les chauffeurs ne voient plus ce qui ne les regarde pas.** Un chauffeur qui
  ouvrait une livraison recevait l'adresse e-mail du client, les références de
  paiement et le budget de la demande. Seul ce qui est nécessaire pour effectuer
  le trajet est désormais envoyé.
- **Les impasses dans les menus sont corrigées.** Le menu chauffeur pointait
  vers un écran que les chauffeurs n'ont pas le droit d'ouvrir, un lien de
  connexion menait à une page inexistante, et « Mes demandes » n'avait aucun
  point d'entrée.

## [2.10.0] - 2026-08-14 · feat

- **L'inscription par adresse e-mail fonctionne de nouveau.** Chaque inscription
  par e-mail échouait avant même l'envoi du message de vérification, car le
  compte recevait un rôle que le système ne reconnaît plus. Les nouveaux comptes
  reçoivent désormais un rôle valide, et un problème d'attribution de ce rôle ne
  peut plus avaler l'e-mail de vérification.
- **Les chauffeurs peuvent enfin faire une offre depuis l'application.** Le
  formulaire d'offre était entièrement construit mais n'apparaissait sur aucun
  écran, il n'y avait donc aucun moyen de proposer une offre par l'interface. Il
  se trouve maintenant sur la page de la demande.
- **Les transporteurs peuvent candidater et gérer leurs véhicules à l'écran, et
  l'équipe peut examiner ces candidatures.** Le formulaire de candidature, la
  liste des documents, les coordonnées bancaires et la liste des véhicules
  n'existaient qu'en coulisses, sans page pour y accéder ; le côté examen
  pointait vers une adresse qui n'a jamais existé et lit désormais les vraies
  candidatures.
- **Les livraisons, l'espace chauffeur et « Mes demandes » ne sont plus des
  impasses.** Les deux premiers étaient des restes de la version précédente du
  produit et plantaient sur des données réelles, et l'enregistrement d'un
  brouillon renvoyait déjà vers une page « Mes demandes » qui n'existait pas.
  Les trois fonctionnent maintenant selon le déroulement réel des livraisons.
- **Le circuit de l'argent fonctionne de bout en bout pour les tests — avec de
  l'argent fictif.** Accepter une offre ne réservait rien : rien ne pouvait donc
  être débité à la livraison et aucun versement n'était jamais exécuté. Pour la
  période de test, il se déroule maintenant jusqu'au bout avec des paiements
  fictifs et la vraie commission de 10 %. Aucune vraie carte n'est débitée.
- **Le site public a été reconstruit autour du transport.** L'ancienne page de
  tarifs obsolète a disparu, et les textes français et anglais de l'application
  sont de nouveau alignés, à 1 283 phrases chacun.

## [2.9.1] - 2026-08-13 · infra

- **Rien de visible ne change** — cette version est un travail de fond :
  l'en-tête de CLAUDE.md ne contredit plus sa propre section d'état. Son
  objectif est consigné dans [STATUS.md](./STATUS.md).

## [2.9.0] - 2026-08-13 · ux

- **La barre du bas correspond maintenant à ce que vous faites réellement.** Les
  chauffeurs et transporteurs y trouvent le tableau des demandes, leurs offres
  et leurs livraisons. Les personnes qui publient des demandes gardent le bouton
  de publication. Une seule barre ne pouvait pas servir les deux, et la version
  de compromis enfouissait le travail du chauffeur.
- **Si vous publiez et conduisez à la fois, vous obtenez la barre chauffeur.**
  C'est le côté où le travail est urgent — une fenêtre d'offres qui se ferme, un
  trajet à démarrer — c'est donc lui qui l'emporte.
- **Les nouveaux libellés existent en français et en anglais.** Les deux langues
  ont été vérifiées clé par clé, et non à l'œil.

## [2.8.0] - 2026-08-13 · feat

- **Le tableau se lit désormais comme une liste de demandes plutôt que comme une
  boutique.** Chaque carte commence par la destination de la marchandise, son
  poids, la date du transport et sa rémunération — les quatre éléments sur
  lesquels un chauffeur décide vraiment. La longue description n'apparaît plus
  du tout sur la carte.
- **Les demandes sur le point de se clore sont signalées.** Toute demande dont
  la fenêtre d'offres se ferme dans moins de six heures est marquée, pour qu'une
  demande ne soit pas perdue simplement parce que l'échéance est passée
  inaperçue.
- **Vous voyez d'un coup d'œil les demandes sur lesquelles vous avez déjà fait
  une offre.** Elles sont marquées sur le tableau, qui se lit ainsi comme votre
  liste de travail plutôt que comme un catalogue dont il faut se souvenir.
- **Les filtres posent les questions qu'un chauffeur se pose.** Filtrez selon la
  rémunération, le type de chargement et le poids, formulé comme ce que votre
  véhicule peut transporter. La recherche ne vide plus l'écran : en tapant, les
  résultats actuels restent visibles au lieu de laisser place à un indicateur de
  chargement à chaque frappe.
- **La carte suit le tableau.** Les repères se placent désormais sur le point de
  collecte de chaque demande et la vue se cadre autour des demandes actuellement
  listées, sans se recentrer à chaque actualisation de la liste.

## [2.7.0] - 2026-08-13 · feat

- **Les demandes sont désormais classées selon ce qui est déplacé, et non selon
  ce qui est vendu.** Les choix sont : mobilier et déménagement, électroménager,
  palettes et fret, matériaux de construction, véhicules, machines et
  équipements, objets fragiles et œuvres d'art, documents et colis, produits
  réfrigérés, marchandises en vrac, animaux, et autre. Celui ou celle qui publie
  une demande en choisit un, et les chauffeurs peuvent filtrer le tableau par
  catégorie.
- **L'ancien paiement façon boutique a disparu.** Il n'y a ni panier ni rien à
  acheter ici — l'argent s'organise à l'acceptation d'une offre et est prélevé à
  la livraison, les trois écrans de paiement ne servaient donc à rien et ont été
  supprimés.
- **Les rappels de paiement vous mènent maintenant à la livraison.** Le panneau
  des paiements en attente et l'e-mail de paiement renvoyaient à l'écran de
  paiement ; ils ouvrent désormais la livraison à laquelle le paiement se
  rapporte, de sorte que le lien ne mène plus nulle part.

## [2.6.4] - 2026-08-13 · infra

- **Rien de visible ne change** — cette version est un travail de fond : plan
  d'affinage « transport uniquement » et audit des résidus du pivot. Son
  objectif est consigné dans [STATUS.md](./STATUS.md).

## [2.6.3] - 2026-08-13 · fix

- **Une livraison terminée ne reste plus avec son argent non comptabilisé.**
  Marquer une demande comme livrée prélève maintenant le paiement qui était
  retenu et enregistre ce qui est dû au chauffeur, au même moment.
- **Annuler une demande qui n'a jamais été livrée libère désormais l'argent
  retenu sur la carte du client**, au lieu d'essayer de rembourser un débit qui
  n'a jamais eu lieu.
- **Un client arrivé par Expedion voit maintenant la livraison avancer sans
  quitter son application.** L'attribution à un chauffeur, chaque changement de
  statut, la preuve de livraison et l'annulation sont tous remontés —
  auparavant, le lien existait mais rien n'y circulait jamais, et « retrait en
  cours » n'apparaissait donc jamais de leur côté.
- **Une brève panne de paiement ne peut plus empêcher l'enregistrement d'une
  livraison comme livrée.** La marchandise est bel et bien arrivée ; l'argent
  est retenté séparément.

## [2.6.2] - 2026-08-13 · infra

- **Rien de visible ne change** — cette version est un travail de fond : tests
  de spécification des demandes, avec les cas limites de la fenêtre d'offres
  fixés. Son objectif est consigné dans [STATUS.md](./STATUS.md).

## [2.6.1] - 2026-08-13 · infra

- **Une demande dont la fenêtre d'offres est passée se clôt maintenant toute
  seule.** Elle restait ouverte et continuait de recevoir des offres qui ne
  pourraient jamais être acceptées ; désormais elle se clôt, les offres en
  attente sont marquées comme expirées et le client est prévenu. L'argent de
  personne n'est touché — rien n'a jamais été retenu sur une demande qui n'a
  jamais été attribuée.
- **Les chauffeurs sont prévenus 30 jours avant l'expiration d'un permis ou
  d'une attestation d'assurance.** Si un document obligatoire expire, le compte
  est suspendu jusqu'à son renouvellement : vous le savez donc à l'avance, et
  non au moment où vous essayez de faire une offre.
- **Les tâches automatiques en arrière-plan ne peuvent plus être déclenchées par
  un inconnu qui devine l'adresse web.** Si le mot de passe partagé qui les
  protège est absent, la requête est rejetée net au lieu d'être acceptée.

## [2.6.0] - 2026-08-13 · feat

- **Les chauffeurs obtiennent leur premier écran : la liste de toutes les offres
  qu'ils ont faites.** Chacune affiche son état — en attente, acceptée, refusée,
  retirée ou expirée — et une offre encore en attente peut être retirée.
- **Le formulaire d'offre et les appels de candidature de chauffeur sont
  construits, mais aucun écran ne les ouvre encore.** Tout ce qui suit décrit
  leur comportement une fois qu'un lien y mènera.
- **Un utilitaire trop petit pour le chargement est grisé plutôt que masqué.**
  Un chauffeur qui ne retrouve pas son propre véhicule croit que le formulaire
  est cassé ; il peut maintenant voir pourquoi celui-ci n'est pas
  sélectionnable.
- **Faire une offre au-dessus du budget du client est autorisé — vous recevez un
  avertissement, pas un blocage.** Le budget est ce que le client s'attend à
  payer, et les chauffeurs proposent couramment plus.
- **Les pièces d'identité et le permis ne transitent jamais par la voie d'envoi
  publique.** Elles sont envoyées directement au serveur avec la requête et ne
  sont relues que par un lien qui expire.
- **Les refus disent ce qui s'est passé avec des mots sur lesquels vous pouvez
  agir :** pas encore approuvé, vous avez déjà fait une offre sur cette demande,
  ce véhicule est trop petit, cet horaire de collecte est hors de la fenêtre de
  la demande.

## [2.5.1] - 2026-08-13 · infra

- **Rien de visible ne change** — cette version est un travail de fond : tests
  de spécification du moteur d'offres et de l'intégration des transporteurs. Son
  objectif est consigné dans [STATUS.md](./STATUS.md).

## [2.5.0] - 2026-08-13 · feat

- **Quand une offre est acceptée, la carte du client est mise en réserve pour
  que le chauffeur voie que la demande est financée.** L'argent lui-même ne
  circule qu'une fois la marchandise livrée.
- **Les chauffeurs qui perdent une offre en sont désormais informés dans
  l'application.** Proposer une offre dans le silence tout en gardant sa
  capacité disponible était la pire chose qui pouvait arriver à un chauffeur ;
  le gagnant est informé lui aussi.
- **Une demande terminée ne paie plus qu'une seule personne : le chauffeur.**
  L'ancien système partageait une même commande entre un vendeur et un
  chauffeur, ce qui ne correspond plus au fonctionnement d'une demande de
  transport. Il s'agit désormais d'un seul paiement au chauffeur, du prix moins
  la part de la plateforme, prélevée à la source.
- **Les prix étaient exprimés par défaut en roupies indonésiennes sur un produit
  limité à la France.** L'argent est maintenant enregistré en euros.
- **Les textes français et anglais sont de nouveau complets.** Il manquait 3
  phrases à l'anglais et 57 au français, et les formulations héritées de
  l'ancien produit d'enchères ont été retirées des deux.

## [2.4.0] - 2026-08-13 · feat

- **Publier une demande de transport se fait maintenant en un formulaire de
  quatre étapes : quoi, où, quand et budget.** Chaque étape est vérifiée
  séparément : aucun champ d'un écran que vous n'avez pas encore atteint ne vous
  bloque.
- **Une adresse d'appartement doit désormais indiquer l'étage et la présence
  d'un ascenseur.** Les deux changent la difficulté réelle de la demande, et un
  chauffeur établit son prix en fonction.
- **Le champ budget dit maintenant clairement que c'est ce que vous comptez
  payer, et non une limite.** Les chauffeurs peuvent proposer plus, et le font ;
  une offre au-dessus du budget s'affiche comme une offre normale, avec l'écart
  indiqué, plutôt que signalée comme une erreur.
- **La page de la demande présente les offres concurrentes côte à côte.** Chaque
  offre est comparée au budget et la moins chère est marquée, mais rien n'est
  choisi automatiquement — c'est toujours une personne qui choisit le gagnant.
  Vous ne voyez que les offres que vous avez le droit de voir ; celles que vous
  ne pouvez pas voir ne sont jamais envoyées à votre appareil.
- **Les écrans hérités de l'ancienne place de marché de biens ont disparu.** La
  suggestion de prix automatique, l'envoi du bordereau d'achat et la page de
  profil vendeur ont été supprimés plutôt que laissés à l'abandon.
- **Deux refus reviennent maintenant sous une forme sur laquelle vous pouvez
  agir** plutôt que sous forme de code brut : la demande vient d'être attribuée
  à quelqu'un d'autre, ou vous devez ajouter un moyen de paiement avant de
  pouvoir accepter une offre.

## [2.3.0] - 2026-08-13 · feat

- **Candidater pour conduire est désormais un vrai parcours, que l'on peut
  enregistrer.** Vous pouvez garder un brouillon, le soumettre, le retirer,
  ajouter vos coordonnées bancaires, envoyer vos documents et gérer vos
  véhicules — et un administrateur examine la file et approuve, refuse ou
  suspend.
- **Vos pièces d'identité ne peuvent plus être ouvertes par quiconque détient le
  lien.** Elles sont stockées en privé et ouvertes par un lien valable cinq
  minutes, délivré uniquement après vérification de l'identité de la personne
  qui le demande.
- **Les avis portent désormais sur une livraison, et non sur une annonce.**
  Seules les deux personnes concernées par une livraison peuvent l'évaluer, une
  seule fois chacune, et seulement une fois qu'elle a réellement été livrée.
- **Les chiffres de l'administration mesurent maintenant le transport.** La
  valeur totale est ce qui a réellement été livré, et le revenu de la plateforme
  est la commission prélevée sur les paiements — et non plus des restes de
  l'ancienne place de marché de biens.
- **Un décompte erroné de la liste d'avis est corrigé.** Quand les avis étaient
  filtrés, la page indiquait combien il y avait d'avis au total plutôt que
  combien correspondaient au filtre.

## [2.2.0] - 2026-08-13 · feat

- **La candidature pour conduire vous indique d'un coup tout ce qui manque.** La
  candidature est vérifiée en une seule passe : vous voyez la liste complète des
  manques au lieu de corriger un point, de renvoyer, puis d'apprendre
  l'existence du suivant.
- **Un SIRET, un IBAN, un BIC, une plaque d'immatriculation ou un numéro de
  téléphone mal saisi est détecté immédiatement.** Ces contrôles repèrent les
  fautes de frappe, pas les entreprises non immatriculées — un examinateur
  humain confirme toujours que l'entreprise existe vraiment.
- **Vos coordonnées bancaires complètes ne sont jamais conservées ici.** L'IBAN
  et le BIC sont vérifiés, puis réduits à leurs 4 derniers caractères avant tout
  enregistrement ; la valeur complète reste chez le prestataire de paiement.
- **Les chauffeurs ne voient jamais les prix, les offres ni les versements.**
  Les montants commerciaux sont retirés avant l'envoi d'une livraison à
  l'appareil d'un chauffeur, au lieu d'être simplement masqués à l'écran.
- **Envoyez le bordereau de la salle des ventes et les informations en sont lues
  pour vous.** Vous confirmez ce qui a été lu sur un écran de vérification avant
  que le devis ne soit chiffré, de sorte que rien n'est rempli dans votre dos.
- **Une demande payée que personne ne prend arrive maintenant automatiquement
  aux chauffeurs ici.** Quand aucun chauffeur ne prend à temps une demande
  Expedion payée, elle devient une demande ouverte sur cette application, les
  chauffeurs font des offres, et le client reste dans sa propre application —
  avec un SMS quand le devis est prêt, quand un chauffeur est attribué et quand
  la livraison avance.

## [2.1.1] - 2026-08-13 · infra

- **Rien de visible ne change** — cette version est un travail de fond :
  CLAUDE.md réécrit pour le produit de transport v2.0. Son objectif est consigné
  dans [STATUS.md](./STATUS.md).

## [2.1.0] - 2026-08-13 · feat

- **Les transporteurs peuvent maintenant faire une offre sur une demande de
  transport.** Un transporteur soumet une offre avec son prix et le véhicule qui
  effectuera le trajet, peut la retirer, et voit ses propres offres au même
  endroit.
- **Deux personnes ne peuvent jamais remporter la même demande.** Si une demande
  est acceptée deux fois au même instant, une seule offre l'emporte — l'autre
  tentative est refusée au lieu de créer une seconde livraison.
- **Une carte refusée ne laisse plus une demande à moitié attribuée.** Si
  l'autorisation de paiement échoue après l'acceptation d'une offre, la demande
  retourne aussitôt sur la place de marché avec toutes ses offres.
- **Appuyer deux fois sur « accepter » pour le gagnant est sans conséquence.**
  Vous récupérez simplement la livraison qui existe déjà, au lieu d'en démarrer
  une seconde.
- **Un transporteur ne voit que sa propre offre.** Tous les autres voient le
  nombre d'offres et le prix le plus bas ; seule la personne qui a publié la
  demande les voit toutes — et c'est garanti par le système, pas seulement
  masqué à l'écran.

## [2.0.2] - 2026-08-13 · infra

- **L'achat et la vente de biens, c'est terminé.** Les pages d'enchères, « Mes
  enchères », « Mes offres » et le paiement du gagnant ont tous été supprimés.
  Cette application ne porte plus que sur le déplacement d'objets, pas sur leur
  vente.
- **Une annonce est désormais une demande de transport.** Au lieu d'un objet
  avec un prix, une demande indique ce qui est déplacé, où il est récupéré et
  livré, quand cela doit avoir lieu, et ce que le client a déjà payé.
- **Les transporteurs font des offres, pas des enchères.** Une offre est un
  devis concurrent sur une demande, et elle nomme le véhicule qui effectuera
  réellement le travail. Vous pouvez avoir une offre active par demande —
  retirez-la et vous pouvez de nouveau faire une offre.
- **Le profil d'un chauffeur peut maintenant contenir plus d'un véhicule.**
  L'ancien profil ne pouvait en décrire qu'un seul, ce qui empêchait de préciser
  lequel de vos véhicules serait utilisé pour une demande donnée.
- **L'argent est compté en euros.** Les nouveaux paiements étaient par défaut en
  roupies indonésiennes, ce qui est manifestement faux pour un service limité à
  la France.

## [2.0.1] - 2026-08-13 · infra

- **Rien de visible ne change** — cette version est un travail de fond : plan
  SDD et quatre spécifications pour le socle d'offres de la phase A. Son
  objectif est consigné dans [STATUS.md](./STATUS.md).

## [2.0.0] - 2026-08-13 · infra

- **L'application s'appelle désormais EXPEDITOO, et elle ne se présente plus
  comme un site d'enchères.** Le mot « Enchères » a disparu du titre de
  l'application, du nom affiché sur votre écran d'accueil à l'installation et
  des raccourcis — car vendre des biens n'est plus sa raison d'être.
- **L'ancienne place de marché de biens est encore là pour l'instant.** C'est le
  dernier instantané complet avant son retrait et son remplacement par les
  demandes de transport et les offres des chauffeurs, conservé volontairement
  pour avoir de quoi revenir en arrière.
