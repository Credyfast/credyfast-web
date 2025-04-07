document.getElementById("loginForm").addEventListener("submit", function(event) {
    event.preventDefault();
    
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const errorMessage = document.getElementById("error-message");
    
    // Usuarios de prueba
    const users = {
        "admin": { password: "1234", role: "superadmin" },
        "castillo": { password: "515253", role: "superadmin" },
        "vendedor": { password: "5678", role: "vendedor" },
        "cobranza": { password: "91011", role: "cobranza" }
    };
    
    if (users[username] && users[username].password === password) {
        localStorage.setItem("userRole", users[username].role);
        window.location.href = "dashboard.html";
    } else {
        errorMessage.textContent = "Usuario o contraseña incorrectos";
    }
});
