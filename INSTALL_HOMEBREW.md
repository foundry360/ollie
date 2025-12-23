# Install Homebrew

Run this command in your Terminal:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**What will happen:**
1. It will ask for your Mac password (for sudo access)
2. It will download and install Homebrew
3. It may take a few minutes

**After installation, you'll see instructions to add Homebrew to your PATH.**

Usually you need to run:
```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

**Then install Supabase CLI:**
```bash
brew install supabase/tap/supabase
```

**Then you can run the secrets script:**
```bash
./set-secrets-quick.sh
```







