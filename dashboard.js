document.addEventListener("DOMContentLoaded", function () {
    const userRole = localStorage.getItem("userRole");
    const userRoleSpan = document.getElementById("user-role");
    const menu = document.getElementById("menu");

    if (!userRole) {
        window.location.href = "index.html"; // Redirigir si no hay sesión
        return;
    }

    userRoleSpan.textContent = userRole;

    const options = {
        "superadmin": [
            { id: "btn-celulares", text: "Registro de Celulares", link: "celulares.html" },
            { id: "btn-clientes", text: "Registro de Clientes", link: "clientes.html" },
            { id: "btn-pagos", text: "Registrar Pagos", link: "pagos.html" },
            { id: "btn-morosidad", text: "Clientes Morosos", link: "morosos.html" }
        ],
        "vendedor": [
            { id: "btn-clientes", text: "Registro de Clientes", link: "clientes.html" },
            { id: "btn-pagos", text: "Registrar Pagos", link: "pagos.html" }
        ],
        "cobranza": [
            { id: "btn-morosidad", text: "Clientes Morosos", link: "morosos.html" },
            { id: "btn-pagos", text: "Registrar Pagos", link: "pagos.html" }
        ]
    };

    // Limpiar menú y agregar las opciones correspondientes
    menu.innerHTML = "";
    if (options[userRole]) {
        options[userRole].forEach(option => {
            let button = document.createElement("button");
            button.id = option.id;
            button.textContent = option.text;
            button.addEventListener("click", function () {
                window.location.href = option.link; // Redirigir a la página correspondiente
            });
            menu.appendChild(button);
        });
    }

    // Logout
    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Cerrar Sesión";
    logoutBtn.addEventListener("click", function () {
        localStorage.removeItem("userRole");
        window.location.href = "index.html";
    });
    menu.appendChild(logoutBtn);
});
