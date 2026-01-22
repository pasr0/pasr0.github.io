<?php
// server.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

// Si on reçoit des données (méthode POST), on les sauvegarde
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    // On écrit les données dans un fichier 'last_scan.json'
    file_put_contents('last_scan.json', $input);
    echo json_encode(["status" => "success"]);
} 
// Sinon (méthode GET), on ne fait rien de spécial, le fichier .json sera lu directement
else {
    echo json_encode(["status" => "ready"]);
}
?>
