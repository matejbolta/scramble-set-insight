import streamlit as st
from backend import alg_counter_main

# Scramble input
scrambles = st.text_area('''Input scrambles from either of: \n - csTimer ScrambleGenerator (all prefixes supported) \n - or csTimer Session Statistics (no edits necessary).''', height=150, help="Paste scrambles here")

# Edge method selection using radio buttons
edge_method = st.radio(
    "Edge Tracing:",
    options=["Weak Swap", "Pseudo Swap"],
    index=0,
)
edge_method_map = {"Weak Swap": "weakswap", "Pseudo Swap": "pseudoswap"}
edge_method = edge_method_map[edge_method]

# Custom weights for flips and twists
flip_weight = st.number_input("Algs per Floating 2-Flip:", min_value=0.0, step=0.5, value=1.0)
twist_weight = st.number_input("Algs per Floating 2-Twist:", min_value=0.0, step=0.5, value=1.0)

# LTCT toggle
ltct = st.checkbox("I use LTCT", value=False)

# DNF toggle
dnf = st.checkbox("Include DNFs", value=False)

# Button to calculate alg counts
if st.button("Insight"):
    if scrambles.strip():
        try:
            # Call the main backend function
            (
                number_of_solves,
                number_of_cases_with_n_algs_dict,
                average_algs_per,
                total_algs,
                total_two_flips,
                total_two_twists,
                alg_count_list
            ) = alg_counter_main(scrambles, edge_method=edge_method, flip_weight=flip_weight, twist_weight=twist_weight, ltct=ltct, dnf=dnf)

            # Display the results
            st.success(f"Success! Scrambles: **{number_of_solves}**")
            for algs, count in number_of_cases_with_n_algs_dict.items():
                st.write(f"{algs}: **{count}**")
            st.write("---")
            st.write(f"Average Algs per Scramble: **{average_algs_per}**")
            st.write(f"Total Algs: **{total_algs}**")
            st.write("---")
            st.write(f"Floating 2-Flips: **{total_two_flips}**")
            st.write(f"Floating 2-Twists: **{total_two_twists}**")
            st.write("---")
            st.write("Algs per Scramble:")
            st.write(f"**{alg_count_list}**")
        except: # Exception as e:
            st.error("Paste text from csTimer Session Statistics or from csTimer tool ScrambleGenerator.")
    else:
        st.warning("Paste some scrambles first!")
