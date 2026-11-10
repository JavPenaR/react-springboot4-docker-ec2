package cl.ejemplo.demo;

import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class SaludoController {
    @GetMapping("/estado")
    public Map<String, String> estado() {
        return Map.of("estado", "ok", "servicio", "Spring Boot 4", "horaServidor", Instant.now().toString());
    }

    @PostMapping("/saludos")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> saludar(@RequestBody SaludoRequest request) {
        String nombre = request.nombre() == null ? "" : request.nombre().trim();
        if (nombre.isEmpty() || nombre.length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El nombre debe tener entre 1 y 80 caracteres");
        }
        return Map.of("mensaje", "¡Hola, " + nombre + "! React y Spring Boot se comunicaron correctamente.");
    }

    public record SaludoRequest(String nombre) {}
}

