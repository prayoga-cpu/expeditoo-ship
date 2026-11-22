# Pages et actions du site Expeditop
Ce dossier contient la feuille **`site_pages_actions.csv`** : toutes les pages du site et, pour chacune, toutes les actions qu'une personne peut y faire (boutons, liens, formulaires, onglets, filtres, menus), avec le libellé exact affiché à l'écran et les rôles concernés.
Elle sert de référence commune : pour demander une modification, il suffit de citer la ligne.
## Ouvrir la feuille
- Fichier : `docs/site_pages_actions.csv` — UTF-8 avec BOM, séparateur point-virgule : il s'ouvre directement dans Excel en français.
- Colonnes : `Réf` ; `Espace` ; `Page` ; `URL` ; `Rôles` ; `Accès depuis` ; `Action` ; `Type` ; `Ce que ça fait` ; `Remarques`.
- Une ligne par action. `Rôles` indique qui peut faire **cette action** (pas seulement qui voit la page).
- `Type` : Bouton, Lien, Formulaire, Onglet, Filtre, Menu, Automatique.
- Une flèche « → » dans `Action` décrit la suite ouverte par le bouton (fenêtre de confirmation, champs, bouton final).
## Citer une ligne dans une demande
Chaque ligne porte une référence stable `Pnn-Ann` : numéro de page, puis numéro d'action. Commencez le message par le rôle concerné entre crochets, puis la référence :
```
[Admin] P64-A04 : renommer « Enregistrer le virement » en « Valider le virement ».
[Demandeur] P19-A34 : « Publier la demande » devrait demander une confirmation.
[Transporteur] P38-A09 : ajouter un filtre par type de véhicule.
```
Pour une nouvelle action sur une page existante, citez seulement la page : « [Chauffeur interne] P48 : ajouter … ».
Un numéro d'action n'est jamais réutilisé : quand une action disparaît de l'écran, sa ligne est supprimée de la feuille et son numéro reste vacant (la suite de numéros d'une page peut donc avoir des trous), et une nouvelle action reçoit le premier numéro jamais utilisé de sa page.
## Vocabulaire des rôles
| Rôle dans la feuille | Qui c'est | Rôle technique |
|---|---|---|
| Visiteur | Personne non connectée | aucun |
| Demandeur | Tout compte connecté : il peut demander un transport | `shipper` (donné à chaque inscription) |
| Transporteur | Chauffeur professionnel externe dont le dossier est approuvé : il fait des offres et touche des gains | `carrier` |
| Chauffeur interne | Chauffeur de l'équipe Expeditop (« particulier ») : il exécute les courses qu'on lui confie, sans voir prix, offres ni versements | `driver` |
| Admin | Accès complet au Panneau d'administration | `admin` |
| Opérateur / Support / Finance | Rôles d'équipe : les services les acceptent pour certaines actions (attribution, support, remboursements) | `operator`, `support`, `finance` |
**À savoir.** Les rôles d'équipe entrent dans l'administration : l'admin ouvre toutes les pages `/admin`, l'opérateur, le support et la finance seulement celles que leur rôle permet (tableau ci-dessous, tiré de `src/lib/admin-access.ts`). Le mode « Admin » ouvre la première page autorisée du compte, et le menu ne montre que ces pages. Dans la colonne `Rôles` des pages d'administration, chaque ligne liste donc « Admin » et, le cas échéant, « Opérateur », « Support », « Finance ». Ce tableau règle l'accès aux **pages** ; chaque action reste de plus vérifiée par le serveur, qui peut être plus strict (par exemple, sur « Chauffeurs » l'opérateur ouvre les dossiers mais seul l'admin approuve, refuse ou suspend).
L'application a trois **modes d'accès** (pastille en haut à gauche) : Utilisateur, Chauffeur, Admin. Le mode change le menu, pas les droits.
### Qui ouvre quelle page d'administration
| Page | URL | Admin | Opérateur | Support | Finance |
|---|---|---|---|---|---|
| Supervision (Passerelle Expedion) | `/admin/expedion` | oui | non | non | non |
| Bordereaux | `/admin/bordereaux` | oui | oui | non | non |
| File d'attribution | `/admin/awards` | oui | oui | non | non |
| Annonces | `/admin/listings` | oui | oui | non | non |
| Expéditions | `/admin/shipments` | oui | oui | non | non |
| Utilisateurs | `/admin/users` | oui | non | non | non |
| Clients Expedion | `/admin/expedion-clients` | oui | non | non | non |
| Chauffeurs (onglet Dossiers ; onglet Chauffeurs pour l'admin seul) | `/admin/drivers` | oui | oui | non | non |
| Paiements | `/admin/payments` | oui | non | non | non |
| Retraits | `/admin/withdrawals` | oui | oui | non | oui |
| Incidents | `/admin/incidents` | oui | oui | non | non |
| Retours | `/admin/feedback` | oui | oui | non | non |
| Chats de support | `/admin/support` | oui | non | oui | non |
| Conversation de support | `/admin/support/[id]` | oui | non | oui | non |
| Demandes et messages d'un utilisateur | `/admin/users/[id]/activity` | oui | non | oui | non |
| Paramètres de la plateforme | `/admin/settings` | oui | non | non | oui |
## Pages
| Réf page | Espace | Page | URL | Rôles | Actions |
|---|---|---|---|---|---|
| P01 | Site public | En-tête et pied de page du site public (toutes les pages publiques) | `(toutes les pages publiques)` | Visiteur ; Demandeur ; Transporteur ; Chauffeur interne ; Admin | 19 |
| P02 | Site public | Accueil — « Les courses viennent à vous. Vous fixez le prix. » | `/` | Visiteur ; Demandeur ; Transporteur ; Chauffeur interne ; Admin | 5 |
| P03 | Site public | Comment les transporteurs sont vérifiés | `/verification` | Visiteur ; Demandeur ; Transporteur ; Chauffeur interne ; Admin | 2 |
| P04 | Site public | Pour les maisons de vente et leurs acheteurs | `/auction-houses` | Visiteur ; Demandeur ; Transporteur ; Chauffeur interne ; Admin | 2 |
| P05 | Site public | Journal des versions — « Ce qui a changé » | `/changelog` | Visiteur ; Demandeur ; Transporteur ; Chauffeur interne ; Admin | 1 |
| P06 | Site public | Nous écrire (contact) | `/contact` | Visiteur ; Demandeur ; Transporteur ; Chauffeur interne ; Admin | 3 |
| P07 | Site public | Conditions générales d'utilisation | `/terms` | Visiteur ; Demandeur ; Transporteur ; Chauffeur interne ; Admin | 1 |
| P08 | Site public | Mentions légales | `/legal-notice` | Visiteur ; Demandeur ; Transporteur ; Chauffeur interne ; Admin | 1 |
| P09 | Site public | Politique de confidentialité | `/privacy` | Visiteur ; Demandeur ; Transporteur ; Chauffeur interne ; Admin | 1 |
| P10 | Site public | Confirmation d'une étape par lien (SMS) — « Confirmez le retrait » / « Confirmez la réception » | `/confirm/[token]` | Visiteur | 3 |
| P11 | Connexion | Connexion — « Bon retour » | `/signin` | Visiteur | 9 |
| P12 | Connexion | Inscription — « Créer votre compte » | `/signup` | Visiteur | 8 |
| P13 | Connexion | Vérification de l'e-mail — « Vérifiez votre email » | `/verify-email` | Visiteur ; Demandeur | 7 |
| P14 | Connexion | Mot de passe oublié ? | `/forgot-password` | Visiteur | 2 |
| P15 | Connexion | Réinitialiser le mot de passe | `/reset-password` | Visiteur | 6 |
| P16 | Connexion | Bienvenue — « Qu'est-ce qui vous amène sur EXPEDITOP ? » | `/welcome` | Demandeur | 2 |
| P17 | Demandeur | En-tête, menu latéral et barre du bas de l'application (toutes les pages de l'application) | `(toutes les pages de l'application)` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 39 |
| P18 | Demandeur | Tableau de bord — « Votre situation, et ce qui vous attend. » | `/home` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 12 |
| P19 | Demandeur | Demander un transport (4 étapes : Quoi, Où, Quand, Budget) | `/create` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 36 |
| P20 | Demandeur | Demande déposée — page de remerciement | `/create/success/[id]` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 3 |
| P21 | Demandeur | Mes demandes | `/listings/me` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 19 |
| P22 | Demandeur | Page d'une demande (annonce) — onglets Détails / Transporteurs disponibles | `/listing/[id]` | Visiteur ; Demandeur ; Transporteur ; Chauffeur interne ; Admin | 38 |
| P23 | Demandeur | Suivi d'expédition — « Expéditions » | `/deliveries` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 6 |
| P24 | Demandeur | Détail d'une livraison | `/deliveries/[id]` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 10 |
| P25 | Demandeur | Messages | `/messages` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 10 |
| P26 | Demandeur | Conversation | `/messages/[id]` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 12 |
| P27 | Demandeur | Notifications | `/notifications` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 6 |
| P28 | Demandeur | Profil (Identité, Contact, Adresses, Chauffeur, Compte) | `/profile` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 20 |
| P29 | Demandeur | Mes adresses | `/profile/addresses` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 8 |
| P30 | Demandeur | Ajouter une adresse | `/profile/addresses/create` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 5 |
| P31 | Demandeur | Modifier l'adresse | `/profile/addresses/[id]/edit` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 2 |
| P32 | Demandeur | Moyens de paiement | `/profile/payment-methods` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 2 |
| P33 | Demandeur | Ajouter une carte | `/profile/payment-methods/create` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 2 |
| P34 | Demandeur | Historique des transactions (onglets Demandeur / Transporteur) | `/profile/invoices` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 10 |
| P35 | Demandeur | Avis et évaluations | `/profile/reviews` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 3 |
| P36 | Demandeur | Paramètres | `/settings` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 9 |
| P37 | Demandeur | Contact & Aide | `/help` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 5 |
| P38 | Transporteur | Tableau des missions — « Voir les demandes » | `/expedion` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 20 |
| P39 | Transporteur | Mon dossier (candidature chauffeur) | `/carrier/application` | Demandeur ; Transporteur ; Chauffeur interne ; Admin | 11 |
| P40 | Transporteur | Ma flotte | `/carrier/fleet` | Transporteur ; Chauffeur interne | 4 |
| P41 | Transporteur | Mes offres | `/carrier/offers` | Transporteur | 6 |
| P42 | Transporteur | Mes trajets (onglets Prévus, En attente de réponse, En transit, Terminés) | `/carrier/trips` | Transporteur ; Chauffeur interne | 19 |
| P43 | Transporteur | Planificateur de tournée | `/carrier/planner` | Transporteur ; Chauffeur interne | 6 |
| P44 | Transporteur | Mes gains — solde et retraits | `/carrier/withdrawals` | Transporteur | 4 |
| P45 | Chauffeur interne | En-tête et menu de l'Espace Chauffeur (toutes les pages /driver) | `(toutes les pages /driver)` | Transporteur ; Chauffeur interne | 9 |
| P46 | Chauffeur interne | Tableau de bord chauffeur | `/driver/dashboard` | Transporteur ; Chauffeur interne | 5 |
| P47 | Chauffeur interne | Expéditions (mes livraisons) | `/driver/shipments` | Transporteur ; Chauffeur interne | 5 |
| P48 | Chauffeur interne | Détail d'une expédition (course à exécuter) | `/driver/shipments/[id]` | Transporteur ; Chauffeur interne | 15 |
| P49 | Chauffeur interne | Messages (Espace Chauffeur) | `/driver/messages` | Transporteur ; Chauffeur interne | 5 |
| P50 | Chauffeur interne | Conversation (Espace Chauffeur) | `/driver/messages/[id]` | Transporteur ; Chauffeur interne | 4 |
| P51 | Chauffeur interne | Profil (Espace Chauffeur) | `/driver/profile` | Transporteur ; Chauffeur interne | 5 |
| P52 | Chauffeur interne | Assistance chauffeur | `/driver/help` | Transporteur ; Chauffeur interne | 4 |
| P53 | Admin | En-tête et menu du Panneau d'administration (toutes les pages /admin) | `(toutes les pages /admin)` | Admin ; Opérateur ; Support ; Finance | 18 |
| P54 | Admin | Supervision (Passerelle Expedion) | `/admin/expedion` | Admin | 30 |
| P55 | Admin | Bordereaux | `/admin/bordereaux` | Admin ; Opérateur | 6 |
| P56 | Admin | File d'attribution | `/admin/awards` | Admin ; Opérateur | 3 |
| P57 | Admin | Annonces | `/admin/listings` | Admin ; Opérateur | 8 |
| P58 | Admin | Expéditions | `/admin/shipments` | Admin ; Opérateur | 2 |
| P59 | Admin | Utilisateurs | `/admin/users` | Admin | 16 |
| P60 | Admin | Demandes et messages d'un utilisateur | `/admin/users/[id]/activity` | Admin ; Support | 9 |
| P61 | Admin | Clients Expedion | `/admin/expedion-clients` | Admin | 7 |
| P62 | Admin | Chauffeurs (onglets Chauffeurs / Dossiers) | `/admin/drivers` | Admin ; Opérateur | 22 |
| P63 | Admin | Paiements | `/admin/payments` | Admin | 3 |
| P64 | Admin | Retraits | `/admin/withdrawals` | Admin ; Opérateur ; Finance | 4 |
| P65 | Admin | Incidents | `/admin/incidents` | Admin ; Opérateur | 5 |
| P66 | Admin | Retours (avis des utilisateurs) | `/admin/feedback` | Admin ; Opérateur | 9 |
| P67 | Admin | Chats de support | `/admin/support` | Admin ; Support | 4 |
| P68 | Admin | Conversation de support | `/admin/support/[id]` | Admin ; Support | 3 |
| P69 | Admin | Paramètres de la plateforme | `/admin/settings` | Admin ; Finance | 5 |

## Totaux

| Espace | Pages | Actions |
|---|---|---|
| Site public | 10 | 38 |
| Connexion | 6 | 34 |
| Demandeur | 21 | 257 |
| Transporteur | 7 | 70 |
| Chauffeur interne | 8 | 52 |
| Admin | 17 | 154 |
| **Total** | **69** | **605** |

Quatre lignes « En-tête et menu » (P01, et une par espace connecté) regroupent les commandes présentes sur toutes les pages d'un espace.

## Adresses qui redirigent (pas de page propre)

| URL | Redirige vers |
|---|---|
| `/create/success` | `/listings/me` |
| `/admin` | `/admin/expedion` |
| `/admin/dashboard` | `/admin/expedion` |
| `/admin/profile` | `/admin/settings` |
| `/admin/applications` | `/admin/drivers?tab=applications` |

## Points « à vérifier »

Les lignes dont la colonne `Remarques` contient « à vérifier » n'ont pas pu être tranchées à la lecture du code. Filtrez cette colonne dans Excel pour les retrouver.
