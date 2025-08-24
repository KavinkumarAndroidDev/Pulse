// Professional Theme Management System
class ThemeManager {
    constructor() {
        this.init();
    }

    init() {
        // Set default theme based on user preference or system preference
        const savedTheme = localStorage.getItem('pulse-theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const defaultTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
        
        this.setTheme(defaultTheme);
        this.createThemeToggle();
        this.bindEvents();
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('pulse-theme', theme);
        
        // Update meta theme-color for mobile browsers
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', theme === 'dark' ? '#0F172A' : '#FAFBFC');
        } else {
            // Create meta theme-color if it doesn't exist
            const meta = document.createElement('meta');
            meta.name = 'theme-color';
            meta.content = theme === 'dark' ? '#0F172A' : '#FAFBFC';
            document.head.appendChild(meta);
        }
    }

    getTheme() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    }

    toggleTheme() {
        const currentTheme = this.getTheme();
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        
        // Add a subtle animation feedback
        this.animateToggle();
    }

    createThemeToggle() {
        // Remove existing toggles
        const existingToggles = document.querySelectorAll('.theme-toggle');
        existingToggles.forEach(toggle => toggle.remove());

        // Find theme toggle containers
        const containers = document.querySelectorAll('.theme-toggle-container');
        
        containers.forEach(container => {
            const themeToggle = document.createElement('button');
            themeToggle.className = 'theme-toggle';
            themeToggle.setAttribute('aria-label', 'Toggle theme');
            themeToggle.setAttribute('type', 'button');
            themeToggle.innerHTML = `
                <i class="lucide-sun sun-icon" data-lucide="sun"></i>
                <i class="lucide-moon moon-icon" data-lucide="moon"></i>
            `;
            
            container.appendChild(themeToggle);
        });

        // Add to auth pages if no containers found (fallback)
        if (containers.length === 0) {
            const authSection = document.querySelector('#auth-section');
            if (authSection) {
                const themeToggle = document.createElement('button');
                themeToggle.className = 'theme-toggle auth-theme-toggle';
                themeToggle.setAttribute('aria-label', 'Toggle theme');
                themeToggle.setAttribute('type', 'button');
                themeToggle.style.position = 'fixed';
                themeToggle.style.top = 'var(--space-xl)';
                themeToggle.style.right = 'var(--space-xl)';
                themeToggle.style.zIndex = 'var(--z-tooltip)';
                themeToggle.innerHTML = `
                    <i class="lucide-sun sun-icon" data-lucide="sun"></i>
                    <i class="lucide-moon moon-icon" data-lucide="moon"></i>
                `;
                
                document.body.appendChild(themeToggle);
            }
        }
        
        // Initialize Lucide icons if available
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    bindEvents() {
        // Theme toggle click event
        document.addEventListener('click', (e) => {
            if (e.target.closest('.theme-toggle')) {
                this.toggleTheme();
            }
        });

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            // Only auto-switch if user hasn't manually set a preference
            if (!localStorage.getItem('pulse-theme')) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });

        // Keyboard shortcut (Ctrl/Cmd + Shift + T)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                this.toggleTheme();
            }
        });
    }

    animateToggle() {
        const toggle = document.querySelector('.theme-toggle');
        if (toggle) {
            toggle.style.transform = 'scale(0.9) rotate(180deg)';
            setTimeout(() => {
                toggle.style.transform = '';
            }, 200);
        }
    }

    // Public method to programmatically set theme
    static setTheme(theme) {
        if (window.themeManager) {
            window.themeManager.setTheme(theme);
        }
    }

    // Public method to get current theme
    static getTheme() {
        return window.themeManager ? window.themeManager.getTheme() : 'light';
    }
}

// Initialize theme manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.themeManager = new ThemeManager();
    });
} else {
    window.themeManager = new ThemeManager();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}
