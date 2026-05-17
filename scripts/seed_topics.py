#!/usr/bin/env python3
"""
Seed the topic table with the full IB AA HL taxonomy from SPEC.md section 15.
Run once after the initial Alembic migration.
Usage: python3 scripts/seed_topics.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / "backend" / ".env")

from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models.topic import Topic

# fmt: off
TAXONOMY = [
    # (slug, name, parent_slug, order_index)
    ("number_and_algebra", "Number & Algebra", None, 0),
      ("number_and_algebra.sequences_and_series", "Sequences & Series", "number_and_algebra", 0),
        ("number_and_algebra.sequences_and_series.arithmetic", "Arithmetic", "number_and_algebra.sequences_and_series", 0),
        ("number_and_algebra.sequences_and_series.geometric", "Geometric", "number_and_algebra.sequences_and_series", 1),
        ("number_and_algebra.sequences_and_series.infinite_series_convergence", "Infinite Series Convergence", "number_and_algebra.sequences_and_series", 2),
        ("number_and_algebra.sequences_and_series.compound_interest", "Compound Interest", "number_and_algebra.sequences_and_series", 3),
      ("number_and_algebra.exponents_and_logs", "Exponents & Logarithms", "number_and_algebra", 1),
        ("number_and_algebra.exponents_and_logs.laws_of_exponents", "Laws of Exponents", "number_and_algebra.exponents_and_logs", 0),
        ("number_and_algebra.exponents_and_logs.laws_of_logarithms", "Laws of Logarithms", "number_and_algebra.exponents_and_logs", 1),
        ("number_and_algebra.exponents_and_logs.exponential_equations", "Exponential Equations", "number_and_algebra.exponents_and_logs", 2),
      ("number_and_algebra.binomial_theorem", "Binomial Theorem", "number_and_algebra", 2),
      ("number_and_algebra.proof", "Proof", "number_and_algebra", 3),
        ("number_and_algebra.proof.direct_proof", "Direct Proof", "number_and_algebra.proof", 0),
        ("number_and_algebra.proof.contradiction", "Proof by Contradiction", "number_and_algebra.proof", 1),
        ("number_and_algebra.proof.induction", "Mathematical Induction", "number_and_algebra.proof", 2),
        ("number_and_algebra.proof.counterexample", "Counterexample", "number_and_algebra.proof", 3),
      ("number_and_algebra.complex_numbers", "Complex Numbers", "number_and_algebra", 4),
        ("number_and_algebra.complex_numbers.cartesian_form", "Cartesian Form", "number_and_algebra.complex_numbers", 0),
        ("number_and_algebra.complex_numbers.polar_form", "Polar Form", "number_and_algebra.complex_numbers", 1),
        ("number_and_algebra.complex_numbers.de_moivre", "De Moivre's Theorem", "number_and_algebra.complex_numbers", 2),
        ("number_and_algebra.complex_numbers.roots_of_unity", "Roots of Unity", "number_and_algebra.complex_numbers", 3),
      ("number_and_algebra.systems_of_equations", "Systems of Equations", "number_and_algebra", 5),

    ("functions", "Functions", None, 1),
      ("functions.function_basics", "Function Basics", "functions", 0),
        ("functions.function_basics.domain_range", "Domain & Range", "functions.function_basics", 0),
        ("functions.function_basics.composition", "Composition", "functions.function_basics", 1),
        ("functions.function_basics.inverse", "Inverse Functions", "functions.function_basics", 2),
      ("functions.transformations", "Transformations", "functions", 1),
      ("functions.polynomial_functions", "Polynomial Functions", "functions", 2),
      ("functions.rational_functions", "Rational Functions", "functions", 3),
      ("functions.exponential_logarithmic", "Exponential & Logarithmic", "functions", 4),
      ("functions.trigonometric_functions", "Trigonometric Functions", "functions", 5),
      ("functions.modulus_reciprocal_piecewise", "Modulus, Reciprocal & Piecewise", "functions", 6),

    ("geometry_and_trigonometry", "Geometry & Trigonometry", None, 2),
      ("geometry_and_trigonometry.trig_identities", "Trig Identities", "geometry_and_trigonometry", 0),
      ("geometry_and_trigonometry.trig_equations", "Trig Equations", "geometry_and_trigonometry", 1),
      ("geometry_and_trigonometry.circular_functions", "Circular Functions", "geometry_and_trigonometry", 2),
      ("geometry_and_trigonometry.compound_angle_double_angle", "Compound & Double Angle", "geometry_and_trigonometry", 3),
      ("geometry_and_trigonometry.vectors_2d_3d", "Vectors 2D/3D", "geometry_and_trigonometry", 4),
      ("geometry_and_trigonometry.lines_and_planes", "Lines & Planes", "geometry_and_trigonometry", 5),
      ("geometry_and_trigonometry.geometric_proofs", "Geometric Proofs", "geometry_and_trigonometry", 6),

    ("statistics_and_probability", "Statistics & Probability", None, 3),
      ("statistics_and_probability.descriptive_statistics", "Descriptive Statistics", "statistics_and_probability", 0),
      ("statistics_and_probability.probability_basics", "Probability Basics", "statistics_and_probability", 1),
      ("statistics_and_probability.conditional_probability_bayes", "Conditional Probability & Bayes", "statistics_and_probability", 2),
      ("statistics_and_probability.discrete_distributions", "Discrete Distributions", "statistics_and_probability", 3),
        ("statistics_and_probability.discrete_distributions.binomial", "Binomial", "statistics_and_probability.discrete_distributions", 0),
      ("statistics_and_probability.continuous_distributions", "Continuous Distributions", "statistics_and_probability", 4),
        ("statistics_and_probability.continuous_distributions.normal", "Normal", "statistics_and_probability.continuous_distributions", 0),
      ("statistics_and_probability.hypothesis_testing_chi_squared", "Hypothesis Testing & Chi-Squared", "statistics_and_probability", 5),

    ("calculus", "Calculus", None, 4),
      ("calculus.limits", "Limits", "calculus", 0),
      ("calculus.derivatives", "Derivatives", "calculus", 1),
        ("calculus.derivatives.basic_rules", "Basic Rules", "calculus.derivatives", 0),
        ("calculus.derivatives.chain_rule", "Chain Rule", "calculus.derivatives", 1),
        ("calculus.derivatives.product_rule", "Product Rule", "calculus.derivatives", 2),
        ("calculus.derivatives.quotient_rule", "Quotient Rule", "calculus.derivatives", 3),
        ("calculus.derivatives.implicit", "Implicit Differentiation", "calculus.derivatives", 4),
        ("calculus.derivatives.related_rates", "Related Rates", "calculus.derivatives", 5),
      ("calculus.applications_of_derivatives", "Applications of Derivatives", "calculus", 2),
        ("calculus.applications_of_derivatives.extrema", "Extrema", "calculus.applications_of_derivatives", 0),
        ("calculus.applications_of_derivatives.inflection", "Inflection Points", "calculus.applications_of_derivatives", 1),
        ("calculus.applications_of_derivatives.curve_sketching", "Curve Sketching", "calculus.applications_of_derivatives", 2),
        ("calculus.applications_of_derivatives.optimization", "Optimization", "calculus.applications_of_derivatives", 3),
      ("calculus.integrals", "Integrals", "calculus", 3),
        ("calculus.integrals.indefinite", "Indefinite Integrals", "calculus.integrals", 0),
        ("calculus.integrals.definite", "Definite Integrals", "calculus.integrals", 1),
        ("calculus.integrals.by_substitution", "Integration by Substitution", "calculus.integrals", 2),
        ("calculus.integrals.by_parts", "Integration by Parts", "calculus.integrals", 3),
      ("calculus.applications_of_integrals", "Applications of Integrals", "calculus", 4),
        ("calculus.applications_of_integrals.area", "Area", "calculus.applications_of_integrals", 0),
        ("calculus.applications_of_integrals.volume_of_revolution", "Volume of Revolution", "calculus.applications_of_integrals", 1),
        ("calculus.applications_of_integrals.kinematics", "Kinematics", "calculus.applications_of_integrals", 2),
      ("calculus.differential_equations", "Differential Equations", "calculus", 5),
        ("calculus.differential_equations.separable", "Separable", "calculus.differential_equations", 0),
        ("calculus.differential_equations.first_order_linear", "First Order Linear", "calculus.differential_equations", 1),
]
# fmt: on


def seed(db: Session) -> None:
    slug_to_id: dict[str, object] = {}

    for slug, name, parent_slug, order_index in TAXONOMY:
        existing = db.query(Topic).filter_by(slug=slug).first()
        if existing:
            slug_to_id[slug] = existing.id
            continue

        parent_id = slug_to_id.get(parent_slug) if parent_slug else None
        topic = Topic(slug=slug, name=name, parent_id=parent_id, order_index=order_index)
        db.add(topic)
        db.flush()
        slug_to_id[slug] = topic.id
        print(f"  + {slug}")

    db.commit()
    print(f"Seeded {len(slug_to_id)} topics.")


if __name__ == "__main__":
    with SessionLocal() as db:
        seed(db)
