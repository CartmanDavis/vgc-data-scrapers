#!/usr/bin/env python3
"""
Generate competitive Pokemon insights and visualizations
"""

import sqlite3
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
import numpy as np

# Set style
sns.set_style("whitegrid")
plt.rcParams['figure.figsize'] = (14, 8)
plt.rcParams['font.size'] = 10

DB_PATH = 'db/vgc.db'

def get_monthly_usage():
    """Get pokemon usage by month"""
    conn = sqlite3.connect(DB_PATH)
    query = """
    SELECT 
        DATE(tr.date, 'start of month') as month,
        CASE 
            WHEN ps.form IS NOT NULL THEN ps.species || ' (' || ps.form || ')'
            ELSE ps.species
        END as pokemon_name,
        COUNT(DISTINCT ps.id) as usage_count
    FROM pokemon_sets ps
    JOIN teams tm ON ps.team_id = tm.id
    JOIN tournaments tr ON tm.tournament_id = tr.id
    GROUP BY month, pokemon_name
    ORDER BY month, usage_count DESC
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    df['month'] = pd.to_datetime(df['month'])
    return df

def get_recent_months_usage(months_back=6):
    """Get usage data for recent months"""
    conn = sqlite3.connect(DB_PATH)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30*months_back)
    
    query = """
    SELECT 
        DATE(tr.date, 'start of month') as month,
        CASE 
            WHEN ps.form IS NOT NULL THEN ps.species || ' (' || ps.form || ')'
            ELSE ps.species
        END as pokemon_name,
        COUNT(DISTINCT ps.id) as usage_count,
        COUNT(DISTINCT tm.id) as team_count
    FROM pokemon_sets ps
    JOIN teams tm ON ps.team_id = tm.id
    JOIN tournaments tr ON tm.tournament_id = tr.id
    WHERE tr.date >= ?
    GROUP BY month, pokemon_name
    ORDER BY month, usage_count DESC
    """
    df = pd.read_sql_query(query, conn, params=[start_date.strftime('%Y-%m-%d')])
    conn.close()
    
    df['month'] = pd.to_datetime(df['month'])
    return df

def plot_trending_pokemon():
    """Plot rising and falling pokemon usage trends over time"""
    df = get_recent_months_usage(months_back=6)
    
    if len(df) < 2:
        print("Not enough data for trend analysis")
        return
    
    # Calculate trends - remove months with 0 data
    monthly_usage = df.groupby(['month', 'pokemon_name'])['usage_count'].sum().unstack(fill_value=0)
    
    # Filter out months with 0 total usage (no tournaments)
    monthly_totals = monthly_usage.sum(axis=1)
    months_with_data = monthly_totals[monthly_totals > 0].index
    monthly_usage = monthly_usage[monthly_usage.index.isin(months_with_data)]
    
    if len(monthly_usage) < 2:
        print("Not enough months for trend analysis")
        return
    
    first_month = monthly_usage.iloc[0]
    last_month = monthly_usage.iloc[-1]
    
    changes = pd.DataFrame({
        'first_month': first_month,
        'last_month': last_month,
        'change': last_month - first_month,
        'percent_change': ((last_month - first_month) / (first_month + 1)) * 100
    })
    
    # Filter for pokemon with minimum usage
    total_avg = monthly_usage.mean(axis=0)
    changes = changes[total_avg >= 10]
    
    # Top rising and falling
    rising = changes.sort_values('percent_change', ascending=False).head(6)
    falling = changes.sort_values('percent_change', ascending=True).head(6)
    
    fig, axes = plt.subplots(2, 1, figsize=(16, 12))
    
    # Rising Pokemon
    for i, pokemon in enumerate(rising.index):
        if pokemon in monthly_usage.columns:
            data = monthly_usage[pokemon]
            # Only plot points where data exists (>0)
            axes[0].plot(data[data > 0].index, data[data > 0], 
                          marker='o', linewidth=2.5, markersize=6, 
                          label=pokemon)
    
    axes[0].set_xlabel('Month', fontsize=12, fontweight='bold')
    axes[0].set_ylabel('Usage Count', fontsize=12, fontweight='bold')
    axes[0].set_title('Rising Pokemon - Monthly Usage Trends', fontsize=14, fontweight='bold', pad=15)
    axes[0].legend(loc='best', fontsize=10)
    axes[0].grid(True, alpha=0.3)
    axes[0].tick_params(axis='x', rotation=45)
    
    # Falling Pokemon
    for i, pokemon in enumerate(falling.index):
        if pokemon in monthly_usage.columns:
            data = monthly_usage[pokemon]
            # Only plot points where data exists (>0)
            axes[1].plot(data[data > 0].index, data[data > 0], 
                          marker='o', linewidth=2.5, markersize=6, 
                          label=pokemon)
    
    axes[1].set_xlabel('Month', fontsize=12, fontweight='bold')
    axes[1].set_ylabel('Usage Count', fontsize=12, fontweight='bold')
    axes[1].set_title('Falling Pokemon - Monthly Usage Trends', fontsize=14, fontweight='bold', pad=15)
    axes[1].legend(loc='best', fontsize=10)
    axes[1].grid(True, alpha=0.3)
    axes[1].tick_params(axis='x', rotation=45)
    
    plt.tight_layout()
    plt.savefig('visualizations/trending_pokemon.png', dpi=300, bbox_inches='tight')
    print("✅ Saved: visualizations/trending_pokemon.png")
    plt.close()

def plot_top_pokemon_over_time():
    """Plot top pokemon usage over time"""
    df = get_monthly_usage()
    
    # Get top 10 overall
    top_10 = df.groupby('pokemon_name')['usage_count'].sum().nlargest(10).index
    
    # Filter for top 10
    df_top = df[df['pokemon_name'].isin(top_10)].copy()
    
    df_top = df_top.groupby(['month', 'pokemon_name'])['usage_count'].sum().unstack(fill_value=0)
    
    fig, ax = plt.subplots(figsize=(16, 10))
    
    colors = plt.cm.Set3(np.linspace(0, 1, len(top_10)))
    
    for i, pokemon in enumerate(top_10):
        if pokemon in df_top.columns:
            ax.plot(df_top.index, df_top[pokemon], marker='o', linewidth=2.5, 
                   markersize=6, label=pokemon, color=colors[i])
    
    ax.set_xlabel('Month', fontsize=12, fontweight='bold')
    ax.set_ylabel('Usage Count', fontsize=12, fontweight='bold')
    ax.set_title('Top 10 Pokemon Usage Over Time', fontsize=16, fontweight='bold', pad=15)
    ax.legend(loc='best', fontsize=11, framealpha=0.9)
    ax.grid(True, alpha=0.3)
    
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig('visualizations/top_pokemon_timeline.png', dpi=300, bbox_inches='tight')
    print("✅ Saved: visualizations/top_pokemon_timeline.png")
    plt.close()

def plot_item_trends():
    """Plot item usage trends over time"""
    conn = sqlite3.connect(DB_PATH)
    query = """
    SELECT 
        DATE(tr.date, 'start of month') as month,
        item,
        COUNT(*) as usage_count
    FROM pokemon_sets ps
    JOIN teams tm ON ps.team_id = tm.id
    JOIN tournaments tr ON tm.tournament_id = tr.id
    WHERE item IS NOT NULL AND item != 'None'
    GROUP BY month, item
    HAVING usage_count >= 20
    ORDER BY month, usage_count DESC
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    df['month'] = pd.to_datetime(df['month'])
    
    # Get top 10 items
    top_items = df.groupby('item')['usage_count'].sum().nlargest(10).index
    df_top = df[df['item'].isin(top_items)].copy()
    
    item_monthly = df_top.groupby(['month', 'item'])['usage_count'].sum().unstack(fill_value=0)
    
    fig, ax = plt.subplots(figsize=(16, 10))
    
    colors = plt.cm.tab10(np.linspace(0, 1, len(top_items)))
    
    for i, item in enumerate(top_items):
        if item in item_monthly.columns:
            ax.plot(item_monthly.index, item_monthly[item], 
                   marker='o', linewidth=2.5, markersize=6, 
                   label=item, color=colors[i])
    
    ax.set_xlabel('Month', fontsize=12, fontweight='bold')
    ax.set_ylabel('Usage Count', fontsize=12, fontweight='bold')
    ax.set_title('Top 10 Item Usage Over Time', fontsize=16, fontweight='bold', pad=15)
    ax.legend(loc='best', fontsize=11)
    ax.grid(True, alpha=0.3)
    
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig('visualizations/item_trends.png', dpi=300, bbox_inches='tight')
    print("✅ Saved: visualizations/item_trends.png")
    plt.close()

def plot_ability_trends():
    """Plot ability usage trends over time"""
    conn = sqlite3.connect(DB_PATH)
    query = """
    SELECT 
        DATE(tr.date, 'start of month') as month,
        ability,
        COUNT(*) as usage_count
    FROM pokemon_sets ps
    JOIN teams tm ON ps.team_id = tm.id
    JOIN tournaments tr ON tm.tournament_id = tr.id
    WHERE ability IS NOT NULL 
      AND ability NOT IN ('Assault Vest', 'Booster Energy', 'Clear Amulet', 'Covert Cloak')
    GROUP BY month, ability
    HAVING usage_count >= 50
    ORDER BY month, usage_count DESC
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    df['month'] = pd.to_datetime(df['month'])
    
    # Get top 12 abilities
    top_abilities = df.groupby('ability')['usage_count'].sum().nlargest(12).index
    df_top = df[df['ability'].isin(top_abilities)].copy()
    
    ability_monthly = df_top.groupby(['month', 'ability'])['usage_count'].sum().unstack(fill_value=0)
    
    fig, ax = plt.subplots(figsize=(16, 10))
    
    colors = plt.cm.Set3(np.linspace(0, 1, len(top_abilities)))
    
    for i, ability in enumerate(top_abilities):
        if ability in ability_monthly.columns:
            ax.plot(ability_monthly.index, ability_monthly[ability], 
                   marker='o', linewidth=2.5, markersize=6, 
                   label=ability, color=colors[i])
    
    ax.set_xlabel('Month', fontsize=12, fontweight='bold')
    ax.set_ylabel('Usage Count', fontsize=12, fontweight='bold')
    ax.set_title('Top 12 Ability Usage Over Time', fontsize=16, fontweight='bold', pad=15)
    ax.legend(loc='best', fontsize=11)
    ax.grid(True, alpha=0.3)
    
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig('visualizations/ability_trends.png', dpi=300, bbox_inches='tight')
    print("✅ Saved: visualizations/ability_trends.png")
    plt.close()

def plot_tera_type_trends():
    """Plot tera type usage trends over time"""
    conn = sqlite3.connect(DB_PATH)
    query = """
    SELECT 
        DATE(tr.date, 'start of month') as month,
        tera_type,
        COUNT(*) as usage_count
    FROM pokemon_sets ps
    JOIN teams tm ON ps.team_id = tm.id
    JOIN tournaments tr ON tm.tournament_id = tr.id
    WHERE tera_type IS NOT NULL AND tera_type != ''
    GROUP BY month, tera_type
    ORDER BY month, usage_count DESC
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    df['month'] = pd.to_datetime(df['month'])
    
    # Get top types
    top_types = df.groupby('tera_type')['usage_count'].sum().nlargest(15).index
    df_top = df[df['tera_type'].isin(top_types)].copy()
    
    type_monthly = df_top.groupby(['month', 'tera_type'])['usage_count'].sum().unstack(fill_value=0)
    
    fig, ax = plt.subplots(figsize=(16, 10))
    
    # Color by type
    type_colors = {
        'Fairy': '#ff69b4', 'Water': '#3498db', 'Fire': '#e74c3c', 'Grass': '#2ecc71',
        'Electric': '#f1c40f', 'Ice': '#00ced1', 'Fighting': '#ff6347', 'Poison': '#9370db',
        'Ground': '#daa520', 'Flying': '#87ceeb', 'Psychic': '#ff69b4', 'Bug': '#98fb98',
        'Rock': '#a0522d', 'Ghost': '#4b0082', 'Dragon': '#483d8b', 'Steel': '#708090',
        'Dark': '#2f4f4f', 'Normal': '#d3d3d3'
    }
    
    colors = [type_colors.get(t, '#95a5a6') for t in top_types]
    
    for i, type_name in enumerate(top_types):
        if type_name in type_monthly.columns:
            ax.plot(type_monthly.index, type_monthly[type_name], 
                   marker='o', linewidth=2.5, markersize=6, 
                   label=type_name, color=colors[i])
    
    ax.set_xlabel('Month', fontsize=12, fontweight='bold')
    ax.set_ylabel('Usage Count', fontsize=12, fontweight='bold')
    ax.set_title('Top 15 Tera Type Usage Over Time', fontsize=16, fontweight='bold', pad=15)
    ax.legend(loc='best', fontsize=11)
    ax.grid(True, alpha=0.3)
    
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig('visualizations/tera_type_trends.png', dpi=300, bbox_inches='tight')
    print("✅ Saved: visualizations/tera_type_trends.png")
    plt.close()

def plot_top_players_2025():
    """Plot top players by win percentage in 2025"""
    conn = sqlite3.connect(DB_PATH)
    query = """
    SELECT 
        p.name, 
        COUNT(ts.id) as tournaments_played,
        SUM(ts.wins) as total_wins,
        SUM(ts.losses) as total_losses,
        SUM(ts.ties) as total_ties,
        ROUND(100.0 * SUM(ts.wins) / NULLIF(SUM(ts.wins) + SUM(ts.losses), 0), 2) as win_percentage
    FROM tournament_standings ts 
    JOIN players p ON ts.player_id = p.id 
    JOIN tournaments t ON ts.tournament_id = t.id
    WHERE t.date LIKE '2025-%'
    GROUP BY p.id 
    HAVING COUNT(ts.id) >= 5
    ORDER BY win_percentage DESC
    LIMIT 10
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    if len(df) < 2:
        print("Not enough data for visualization")
        return
    
    fig, ax = plt.subplots(figsize=(14, 8))
    
    colors = plt.cm.RdYlGn_r(df['win_percentage'] / 100)
    
    bars = ax.barh(df['name'], df['win_percentage'], color=colors, edgecolor='black', linewidth=0.5)
    
    ax.set_xlabel('Win Percentage (%)', fontsize=12, fontweight='bold')
    ax.set_title('Top 10 Players by Win Percentage in 2025\n(Min 5 Tournaments Played)', 
                fontsize=16, fontweight='bold', pad=15)
    ax.set_xlim(70, 85)
    
    for i, (idx, row) in enumerate(df.iterrows()):
        width = bars[i].get_width()
        ax.text(width + 0.2, bars[i].get_y() + bars[i].get_height()/2,
                f'{row["win_percentage"]:.1f}%',
                ha='left', va='center', fontsize=10, fontweight='bold')
        ax.text(width + 0.2, bars[i].get_y() + bars[i].get_height()/2 + 0.35,
                f'{row["total_wins"]}W-{row["total_losses"]}L',
                ha='left', va='center', fontsize=8, color='#555555')
    
    ax.grid(axis='x', alpha=0.3)
    ax.invert_yaxis()
    
    plt.tight_layout()
    plt.savefig('visualizations/top_players_2025.png', dpi=300, bbox_inches='tight')
    print("✅ Saved: visualizations/top_players_2025.png")
    plt.close()

def plot_signature_move_usage():
    """Plot signature move usage trends over time"""
    conn = sqlite3.connect(DB_PATH)
    query = """
    SELECT 
        DATE(tr.date, 'start of month') as month,
        m.move_name,
        COUNT(*) as usage_count
    FROM pokemon_sets ps
    JOIN teams tm ON ps.team_id = tm.id
    JOIN tournaments tr ON tm.tournament_id = tr.id
    JOIN moves m ON m.pokemon_set_id = ps.id
    WHERE m.move_name IN ('Surging Strikes', 'Wicked Blow', 'Ivy Cudgel', 'Thunderclap', 
                          'Bleakwind Storm', 'Sandy Shocks', 'Flower Trick', 
                          'Raging Bull', 'Tera Blast', 'Steam Eruption')
    GROUP BY month, m.move_name
    ORDER BY month, usage_count DESC
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    df['month'] = pd.to_datetime(df['month'])
    
    # Get moves with minimum usage
    move_usage = df.groupby('move_name')['usage_count'].sum()
    signature_moves = move_usage[move_usage >= 100].index.tolist()
    
    if not signature_moves:
        print("No signature moves with sufficient usage found")
        return
    
    df_sig = df[df['move_name'].isin(signature_moves)].copy()
    
    move_monthly = df_sig.groupby(['month', 'move_name'])['usage_count'].sum().unstack(fill_value=0)
    
    fig, ax = plt.subplots(figsize=(16, 10))
    
    colors = plt.cm.Set1(np.linspace(0, 1, len(signature_moves)))
    
    for i, move in enumerate(signature_moves):
        if move in move_monthly.columns:
            ax.plot(move_monthly.index, move_monthly[move], 
                   marker='o', linewidth=2.5, markersize=6, 
                   label=move, color=colors[i])
    
    ax.set_xlabel('Month', fontsize=12, fontweight='bold')
    ax.set_ylabel('Usage Count', fontsize=12, fontweight='bold')
    ax.set_title('Signature Move Usage Over Time', fontsize=16, fontweight='bold', pad=15)
    ax.legend(loc='best', fontsize=11)
    ax.grid(True, alpha=0.3)
    
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig('visualizations/signature_move_trends.png', dpi=300, bbox_inches='tight')
    print("✅ Saved: visualizations/signature_move_trends.png")
    plt.close()

def plot_top_players_2025():
    """Plot top players by win percentage in 2025"""
    conn = sqlite3.connect(DB_PATH)
    query = """
    SELECT 
        p.name, 
        COUNT(ts.id) as tournaments_played,
        SUM(ts.wins) as total_wins,
        SUM(ts.losses) as total_losses,
        SUM(ts.ties) as total_ties,
        ROUND(100.0 * SUM(ts.wins) / NULLIF(SUM(ts.wins) + SUM(ts.losses), 0), 2) as win_percentage
    FROM tournament_standings ts 
    JOIN players p ON ts.player_id = p.id 
    JOIN tournaments t ON ts.tournament_id = t.id
    WHERE t.date LIKE '2025-%'
    GROUP BY p.id 
    HAVING COUNT(ts.id) >= 5
    ORDER BY win_percentage DESC
    LIMIT 10
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    if len(df) < 2:
        print("Not enough data for visualization")
        return
    
    df = df.sort_values('win_percentage', ascending=True)
    
    fig, ax = plt.subplots(figsize=(14, 8))
    
    colors = plt.cm.RdYlGn_r(df['win_percentage'] / 100)
    
    bars = ax.barh(df['name'], df['win_percentage'], color=colors, edgecolor='black', linewidth=0.5)
    
    ax.set_xlabel('Win Percentage (%)', fontsize=12, fontweight='bold')
    ax.set_title('Top 10 Players by Win Percentage in 2025\n(Min 5 Tournaments Played)', 
                fontsize=16, fontweight='bold', pad=15)
    ax.set_xlim(70, 85)
    
    for i, row in df.iterrows():
        width = bars[i].get_width()
        ax.text(width + 0.3, i, 
                f'{row["win_percentage"]:.1f}%',
                ha='left', va='center', fontsize=11, fontweight='bold')
        ax.text(width + 0.3, i, 
                f'{row["total_wins"]}W-{row["total_losses"]}L',
                ha='left', va='center', fontsize=9, color='#555555')
    
    ax.grid(axis='x', alpha=0.3)
    ax.invert_yaxis()
    
    plt.tight_layout()
    plt.savefig('visualizations/top_players_2025.png', dpi=300, bbox_inches='tight')
    print("✅ Saved: visualizations/top_players_2025.png")
    plt.close()
 
def main():
    print("Generating Competitive Pokemon Visualizations...\n")
    
    try:
        print("1. Analyzing trending pokemon...")
        plot_trending_pokemon()
        
        print("2. Creating top pokemon timeline...")
        plot_top_pokemon_over_time()
        
        print("3. Analyzing item trends...")
        plot_item_trends()
        
        print("4. Analyzing ability trends...")
        plot_ability_trends()
        
        print("5. Analyzing tera type trends...")
        plot_tera_type_trends()
        
        print("6. Analyzing signature move trends...")
        plot_signature_move_usage()
        
        print("\nAll visualizations generated successfully!")
        print("Check 'visualizations' directory for results.")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
