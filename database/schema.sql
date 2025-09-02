-- Batería de Riesgo Psicosocial - Database Schema
-- PostgreSQL Database Schema

-- Create database
CREATE DATABASE brs_database;

-- Use the database
\c brs_database;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Empresas/Organizaciones
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    nit VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    sector VARCHAR(100), -- Sector económico
    size VARCHAR(50), -- Tamaño empresa (micro, pequeña, mediana, grande)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usuarios del sistema
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL, -- admin, evaluator, participant
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Evaluaciones/Procesos
CREATE TABLE evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'active', -- active, completed, cancelled
    total_participants INTEGER DEFAULT 0,
    completed_participants INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Participantes en evaluaciones
CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID REFERENCES evaluations(id) ON DELETE CASCADE,
    
    -- Datos demográficos
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    document_type VARCHAR(10), -- CC, CE, Pasaporte
    document_number VARCHAR(20),
    birth_year INTEGER,
    gender VARCHAR(20),
    marital_status VARCHAR(50),
    education_level VARCHAR(100),
    
    -- Datos laborales
    department VARCHAR(100),
    position VARCHAR(100),
    contract_type VARCHAR(50), -- Fijo, temporal, prestación servicios, etc.
    employment_type VARCHAR(50), -- Tiempo completo, medio tiempo, etc.
    tenure_months INTEGER, -- Antigüedad en meses
    salary_range VARCHAR(50),
    work_hours_per_day INTEGER,
    work_days_per_week INTEGER,
    
    -- Control de aplicación
    form_type VARCHAR(10), -- A o B (según cargo)
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed
    completion_percentage DECIMAL(5,2) DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Respuestas a cuestionarios
CREATE TABLE responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
    questionnaire_type VARCHAR(20) NOT NULL, -- intralaboral_a, intralaboral_b, extralaboral, stress
    question_number INTEGER NOT NULL,
    response_value INTEGER NOT NULL, -- 0-4 según escala Likert
    dimension VARCHAR(100), -- Dimensión a la que pertenece la pregunta
    domain VARCHAR(100), -- Dominio al que pertenece la pregunta
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Resultados calculados
CREATE TABLE results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
    questionnaire_type VARCHAR(20) NOT NULL,
    
    -- Puntajes por dimensión/dominio
    dimension VARCHAR(100),
    raw_score INTEGER,
    transformed_score DECIMAL(5,2),
    percentile DECIMAL(5,2),
    risk_level VARCHAR(50), -- sin_riesgo, bajo, medio, alto, muy_alto
    
    -- Metadatos
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    calculation_version VARCHAR(10) DEFAULT '1.0'
);

-- Reportes generados
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID REFERENCES evaluations(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES participants(id), -- NULL para reportes organizacionales
    report_type VARCHAR(50) NOT NULL, -- individual, organizational, comparative
    file_path VARCHAR(500),
    file_name VARCHAR(255),
    generated_by UUID REFERENCES users(id),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    parameters JSONB -- Parámetros utilizados para generar el reporte
);

-- Configuraciones del sistema
CREATE TABLE system_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auditoría de acciones
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50), -- company, user, evaluation, participant, etc.
    entity_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimización
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_evaluations_company_id ON evaluations(company_id);
CREATE INDEX idx_participants_evaluation_id ON participants(evaluation_id);
CREATE INDEX idx_responses_participant_id ON responses(participant_id);
CREATE INDEX idx_responses_questionnaire_type ON responses(questionnaire_type);
CREATE INDEX idx_results_participant_id ON results(participant_id);
CREATE INDEX idx_reports_evaluation_id ON reports(evaluation_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluations_updated_at BEFORE UPDATE ON evaluations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_participants_updated_at BEFORE UPDATE ON participants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insertar configuraciones iniciales del sistema
INSERT INTO system_configs (config_key, config_value, description) VALUES
('baremos_intralaboral', '{}', 'Tablas de baremos para factores intralaborales'),
('baremos_extralaboral', '{}', 'Tablas de baremos para factores extralaborales'),
('baremos_estres', '{}', 'Tablas de baremos para estrés'),
('cuestionarios_data', '{}', 'Datos de cuestionarios y preguntas'),
('calculation_formulas', '{}', 'Fórmulas de cálculo de puntajes');

-- Comentarios en tablas
COMMENT ON TABLE companies IS 'Empresas/organizaciones que utilizan el sistema';
COMMENT ON TABLE users IS 'Usuarios del sistema con diferentes roles';
COMMENT ON TABLE evaluations IS 'Procesos de evaluación de riesgo psicosocial';
COMMENT ON TABLE participants IS 'Trabajadores que participan en las evaluaciones';
COMMENT ON TABLE responses IS 'Respuestas individuales a preguntas de cuestionarios';
COMMENT ON TABLE results IS 'Resultados calculados por dimensión y dominio';
COMMENT ON TABLE reports IS 'Reportes generados del sistema';
COMMENT ON TABLE system_configs IS 'Configuraciones del sistema (baremos, cuestionarios, etc.)';
COMMENT ON TABLE audit_logs IS 'Log de auditoría de acciones en el sistema';